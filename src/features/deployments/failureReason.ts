// A failed deployment records one line: "<stage>: <what went wrong>". That is
// accurate but reads as plumbing — "clone: merge feature/x into main: conflicts
// in src/a.ts" does not tell QA that their branch needs rebasing. This turns the
// recognized shapes into a headline plus a next step, and always keeps the raw
// line so nothing is hidden.
//
// The worker's wording is the contract here. `clone_test.go` pins the merge
// conflict format on the Go side, so a reword there fails a test rather than
// silently degrading this to the generic case.

export interface FailureReason {
  /** Stable slug — used by tests and to pick an icon. */
  kind:
    | 'merge-conflict'
    | 'branch-missing'
    | 'build-failed'
    | 'builder-missing'
    | 'unknown-strategy'
    | 'health-check'
    | 'compose-include'
    | 'compose-env-file'
    | 'cancelled'
    | 'unknown'
  title: string
  /** What to do about it. Omitted when there is nothing useful to say. */
  hint?: string
  /** The raw recorded line, always shown so detail is never lost. */
  detail: string
  /** Conflicting paths, when the message carried them. */
  files?: string[]
  /** The container's last log line, when it died before answering. */
  lastLog?: string
}

const MERGE_CONFLICT = /^merge (.+?) into (.+?): conflicts in (.+)$/
const FETCH_FAILED = /^fetch(?: source)? (.+?):/
const BUILDER_MISSING = /^(pack|nixpacks|railpack) not found on PATH/
const UNKNOWN_STRATEGY = /^unknown build strategy/
const BUILD_FAILED =
  /^(docker build|docker compose build|docker pull|pack build|nixpacks build|railpack build|docker build \(generated\))/
// The legacy form trails the Go HTTP client's error (with the container's
// internal IP) after the duration, so only the duration token is taken.
const HEALTH_TIMEOUT = /^health check timed out after ([^\s:]+)/
const HEALTH_EXITED =
  /^container exited \(code (-?\d+)\) before answering on port (\d+)(?:: ([\s\S]*))?$/
const HEALTH_SILENT = /^app did not answer on port (\d+) within (\S+)$/
const COMPOSE_INCLUDE = /compose include could not be resolved/
const COMPOSE_ENV_FILE = /^env_file (.+?): path .+ (?:escapes workdir|must be relative)$/

/**
 * Classify a deployment's `errorSummary`. Returns null when there is nothing to
 * show. An unrecognized message still comes back as `unknown` with the raw text,
 * so a new failure mode degrades to today's behaviour rather than disappearing.
 */
export function failureReason(summary: string | null | undefined): FailureReason | null {
  const raw = summary?.trim()
  if (!raw) return null

  if (/^cancelled by user request$/i.test(raw)) {
    return {
      kind: 'cancelled',
      title: 'Cancelled',
      detail: raw,
      hint: 'This deployment was stopped on request — it did not fail on its own.',
    }
  }

  // "<stage>: <rest>", where a stage is a bare snake_case token. Requiring that
  // shape stops a message like "merge a into b: …" from having its own text
  // mistaken for the stage prefix.
  const prefixed = /^([a-z_]+): ([\s\S]+)$/.exec(raw)
  const stage = prefixed ? prefixed[1] : ''
  const rest = prefixed ? prefixed[2] : raw

  const conflict = MERGE_CONFLICT.exec(rest)
  if (conflict) {
    const [, branch, into, files] = conflict
    const list = files
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean)
    return {
      kind: 'merge-conflict',
      title: `Merge conflict — ${branch} into ${into}`,
      hint: `Git could not combine these branches automatically. Resolve the conflict on ${branch} (merge or rebase ${into} into it and push), then deploy again — or deploy without ${branch} in the merge list.`,
      detail: raw,
      files: list,
    }
  }

  if (stage === 'clone') {
    const fetched = FETCH_FAILED.exec(rest)
    if (fetched) {
      return {
        kind: 'branch-missing',
        title: `Could not fetch ${fetched[1]}`,
        hint: 'The branch may have been deleted, force-pushed, or renamed since the deploy was queued. Check it still exists, then deploy again.',
        detail: raw,
      }
    }
  }

  const builder = BUILDER_MISSING.exec(rest)
  if (builder) {
    return {
      kind: 'builder-missing',
      title: `${builder[1]} is not installed on the worker`,
      hint: `This project builds with ${builder[1]}, but the worker host has no ${builder[1]} binary. This is a server setup problem, not a problem with your branch — ask an administrator.`,
      detail: raw,
    }
  }

  if (UNKNOWN_STRATEGY.test(rest)) {
    return {
      kind: 'unknown-strategy',
      title: 'Build method not recognized',
      hint: "Check the project's build settings — the configured build method is not one this worker can run.",
      detail: raw,
    }
  }

  if (BUILD_FAILED.test(rest)) {
    return {
      kind: 'build-failed',
      title: 'Build failed',
      hint: 'The image did not build. The build log above has the compiler or packaging error that caused it.',
      detail: raw,
    }
  }

  if (COMPOSE_INCLUDE.test(rest)) {
    return {
      kind: 'compose-include',
      title: 'Compose file includes another repository',
      hint: 'A project deploys one repository, so `include:` cannot reach a compose file in a sibling checkout. Inline those services into this compose file, or deploy each repository as its own project.',
      detail: raw,
    }
  }

  const envFile = COMPOSE_ENV_FILE.exec(rest)
  if (envFile) {
    return {
      kind: 'compose-env-file',
      title: `env_file ${envFile[1]} points outside the repository`,
      hint: 'Lighthouse writes a missing env_file from this environment\u2019s variables, but only inside the checkout. Point env_file at a path within the repository.',
      detail: raw,
    }
  }

  const exited = HEALTH_EXITED.exec(rest)
  if (exited) {
    const [, code, port, last] = exited
    return {
      kind: 'health-check',
      title: 'The app crashed on start',
      hint: `The container exited with code ${code} before it answered on port ${port}. The last thing it logged is below; open the runtime log for the rest.`,
      detail: raw,
      lastLog: last?.trim() || undefined,
    }
  }

  const silent = HEALTH_SILENT.exec(rest)
  if (silent) {
    const [, port, within] = silent
    return {
      kind: 'health-check',
      title: `The app never answered on port ${port}`,
      hint: `The container kept running, but nothing answered on port ${port} within ${within}. Check that the app listens on that port on 0.0.0.0 (not localhost), or whether it needs longer to boot.`,
      detail: raw,
    }
  }

  const timeout = HEALTH_TIMEOUT.exec(rest)
  if (timeout) {
    return {
      kind: 'health-check',
      title: 'The app never answered on its port',
      hint: `Nothing answered within ${timeout[1]}. Check the runtime log for a crash on boot, and that the app listens on the configured port on 0.0.0.0 (not localhost).`,
      detail: raw,
    }
  }

  if (stage === 'health_check') {
    return {
      kind: 'health-check',
      title: 'Health check failed',
      hint: 'The container did not come up healthy. Check the runtime log for a crash on boot.',
      detail: raw,
    }
  }

  return { kind: 'unknown', title: 'Deployment failed', detail: raw }
}

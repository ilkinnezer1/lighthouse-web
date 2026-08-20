import { shortSha } from '@/lib/utils'
import type { DeploymentStatus, Finding, FindingBuild } from '@/types/api'

// A finding is pinned to the build it was seen on, so the moment it is shown
// anywhere else it has to say so. Everything here answers one question — which
// build is this finding actually about, and is that still the build in front of
// you — because the alternative is a row that quietly implies the wrong one.

/** The minimum a build has to carry to be compared: id first, sha for display. */
export interface BuildRef {
  id: string
  status: DeploymentStatus
  commitSha: string | null
}

/**
 * What an environment is really running: the newest build that SUCCEEDED, not
 * the newest build. A failed deploy on top changes nothing about what is
 * serving traffic, and treating it as current would age every finding by one.
 * Expects the API's newest-first order.
 */
export function currentBuild<T extends BuildRef>(
  deployments: readonly T[] | null | undefined,
): T | null {
  return deployments?.find((d) => d.status === 'SUCCEEDED') ?? null
}

export type FindingFreshness =
  | { kind: 'current' }
  | { kind: 'rebuilt'; foundSha: string | null }
  | { kind: 'superseded'; foundSha: string | null; currentSha: string | null }
  | { kind: 'nothing-deployed'; foundSha: string | null }

/**
 * Compares by deployment id, never by SHA: two builds of the same commit are
 * two builds, and a finding filed on the first was not filed on the second.
 * The SHAs are only what the sentence says out loud.
 */
export function findingFreshness(
  foundOn: FindingBuild,
  current: BuildRef | null | undefined,
): FindingFreshness {
  const foundSha = foundOn.commitSha
  if (!current) return { kind: 'nothing-deployed', foundSha }
  if (current.id === foundOn.id) return { kind: 'current' }
  // Redeployed at the same commit: "now on abc1234" when it was found on
  // abc1234 is a lie dressed as precision — the code did not change.
  if (foundSha && current.commitSha && foundSha === current.commitSha) {
    return { kind: 'rebuilt', foundSha }
  }
  return { kind: 'superseded', foundSha, currentSha: current.commitSha }
}

export function isStale(freshness: FindingFreshness): boolean {
  return freshness.kind !== 'current'
}

function foundClause(foundSha: string | null): string {
  const sha = shortSha(foundSha)
  return sha ? `Found on ${sha}` : 'Found on an earlier build'
}

/**
 * The whole sentence, in plain text — the component renders the same thing with
 * the SHAs in mono, and this is what it hands to `title`.
 */
export function stalenessNote(freshness: FindingFreshness): string | null {
  switch (freshness.kind) {
    case 'current':
      return null
    case 'rebuilt':
      return `${foundClause(freshness.foundSha)} — redeployed since at the same commit`
    case 'superseded': {
      const current = shortSha(freshness.currentSha)
      return current
        ? `${foundClause(freshness.foundSha)} — this environment is now on ${current}`
        : `${foundClause(freshness.foundSha)} — this environment has deployed again since`
    }
    case 'nothing-deployed':
      return `${foundClause(freshness.foundSha)} — nothing is deployed on this environment now`
  }
}

/**
 * Whether the staleness caveat is worth saying at all. A finding with a fixing
 * build already carries a permanent record — found on X, fixed in Y — which
 * stays true whatever is deployed now. Whether that fix is what the environment
 * is currently running is a question about ancestry, and guessing at it from
 * timestamps would break the first time someone rolls back — so it is left to
 * the fix line rather than answered wrongly.
 */
export function needsStalenessNote(finding: Pick<Finding, 'fixedIn'>): boolean {
  return !finding.fixedIn
}

export type FixRange =
  | { kind: 'same-build'; sha: string | null }
  | { kind: 'range'; fromSha: string | null; toSha: string | null }

/**
 * Found-on plus fixed-in is a commit range. The server pins the fix to the
 * environment's latest succeeded build, which can be the build the finding was
 * found on — a config or data fix, truthful, and not a range.
 */
export function fixRange(finding: Pick<Finding, 'foundOn' | 'fixedIn'>): FixRange | null {
  const { foundOn, fixedIn } = finding
  if (!fixedIn) return null
  if (fixedIn.id === foundOn.id) return { kind: 'same-build', sha: foundOn.commitSha }
  return { kind: 'range', fromSha: foundOn.commitSha, toSha: fixedIn.commitSha }
}

export function fixRangeNote(range: FixRange | null): string | null {
  if (!range) return null
  if (range.kind === 'same-build') {
    const sha = shortSha(range.sha)
    return sha ? `Fixed on ${sha}, the build it was found on` : 'Fixed on the build it was found on'
  }
  const from = shortSha(range.fromSha) ?? 'the build it was found on'
  const to = shortSha(range.toSha) ?? 'a later build'
  return `${from} → ${to}`
}

/**
 * Whether the fix build's changes-since-last-deploy range starts exactly at the
 * build the finding was found on. Only then does that commit list describe what
 * fixed it; over any wider range it is other people's work too, and presenting
 * it as the fix would be a guess.
 */
export function fixRangeIsExact(
  changes: { previous: { id: string } | null } | null | undefined,
  finding: Pick<Finding, 'foundOn' | 'fixedIn'>,
): boolean {
  if (!finding.fixedIn || finding.fixedIn.id === finding.foundOn.id) return false
  return !!changes?.previous && changes.previous.id === finding.foundOn.id
}

import { shortSha } from '@/lib/utils'
import type { ChecklistCheck, ChecklistItem, DeploymentRef } from '@/types/api'

// An item is a chore that outlives any one deploy; a tick is a claim about one
// build. Everything here answers the same question findings.staleness answers —
// which build is this claim actually about, and is that the build in front of
// you — because a tick shown next to the wrong build reads as being about it.

export type ChecklistItemState =
  | { kind: 'passed'; check: ChecklistCheck }
  | { kind: 'failed'; check: ChecklistCheck }
  | { kind: 'stale'; check: ChecklistCheck }
  | { kind: 'unchecked' }

export type ChecklistItemStateKind = ChecklistItemState['kind']

/**
 * The server already sorts the newest relevant check into `check` (this build)
 * or `lastCheck` (an earlier one), so this only has to name the four states.
 * `check` wins if both ever arrive: a tick on the build in front of you is
 * never the stale one.
 */
export function itemState(item: Pick<ChecklistItem, 'check' | 'lastCheck'>): ChecklistItemState {
  if (item.check) {
    return item.check.result === 'PASS'
      ? { kind: 'passed', check: item.check }
      : { kind: 'failed', check: item.check }
  }
  if (item.lastCheck) return { kind: 'stale', check: item.lastCheck }
  return { kind: 'unchecked' }
}

/** Whether this item still needs testing on the build being viewed. */
export function isOutstanding(item: Pick<ChecklistItem, 'check' | 'lastCheck'>): boolean {
  return !item.check
}

export type CheckFreshness =
  | { kind: 'this-build' }
  | { kind: 'rebuilt'; checkedSha: string | null }
  | { kind: 'superseded'; checkedSha: string | null; currentSha: string | null }

/**
 * Compares by deployment id, never by SHA: two builds of the same commit are
 * two builds, and a pass on the first was not a pass on the second. The SHAs
 * are only what the sentence says out loud — which is why a redeploy at the
 * same commit gets its own wording instead of "checked on abc1234 — this build
 * is abc1234".
 */
export function checkFreshness(
  check: Pick<ChecklistCheck, 'build'>,
  current: Pick<DeploymentRef, 'id' | 'commitSha'> | null | undefined,
): CheckFreshness {
  const checkedSha = check.build.commitSha
  if (!current || current.id === check.build.id) return { kind: 'this-build' }
  if (checkedSha && current.commitSha && checkedSha === current.commitSha) {
    return { kind: 'rebuilt', checkedSha }
  }
  return { kind: 'superseded', checkedSha, currentSha: current.commitSha }
}

export function isStale(freshness: CheckFreshness): boolean {
  return freshness.kind !== 'this-build'
}

function checkedClause(checkedSha: string | null): string {
  const sha = shortSha(checkedSha)
  return sha ? `Checked on ${sha}` : 'Checked on an earlier build'
}

/**
 * The whole sentence, in plain text — the row renders the same thing with the
 * SHAs in mono, and this is what it hands to `title`.
 */
export function stalenessNote(freshness: CheckFreshness): string | null {
  switch (freshness.kind) {
    case 'this-build':
      return null
    case 'rebuilt':
      return `${checkedClause(freshness.checkedSha)} — this build is a redeploy of the same commit`
    case 'superseded': {
      const current = shortSha(freshness.currentSha)
      return current
        ? `${checkedClause(freshness.checkedSha)} — this build is ${current}`
        : `${checkedClause(freshness.checkedSha)} — this is a later build`
    }
  }
}

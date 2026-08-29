import { personName } from '@/features/findings/findings.format'
import type { ChecklistCheck } from '@/types/api'
import type { ChecklistItemStateKind } from './checklist.staleness'

// Four states, and only two of them are claims about the build in front of you.
// The other two are absences, so they stay grey — the point of the column is
// that a scan down it finds the rows nobody has touched yet.

export const itemStateLabel: Record<ChecklistItemStateKind, string> = {
  passed: 'Passed',
  failed: 'Failed',
  stale: 'Not on this build',
  unchecked: 'Not checked',
}

export const itemDotClass: Record<ChecklistItemStateKind, string> = {
  passed: 'bg-signal-live',
  failed: 'bg-signal-error',
  stale: 'bg-signal-idle',
  unchecked: 'border border-ink-4 bg-transparent',
}

export const itemTextClass: Record<ChecklistItemStateKind, string> = {
  passed: 'text-signal-live',
  failed: 'text-signal-error',
  stale: 'text-ink-4',
  unchecked: 'text-ink-4',
}

/**
 * `Passed by Aysel · 2h ago`. Named out loud on every row and visible to the
 * whole team, because the thing that wastes an afternoon is two people testing
 * the same ticket without knowing it.
 */
export function checkedLine(
  check: Pick<ChecklistCheck, 'result' | 'checkedBy'>,
  ago: string,
): string {
  const verb = check.result === 'PASS' ? 'Passed' : 'Failed'
  const by = check.checkedBy ? ` by ${personName(check.checkedBy)}` : ''
  return ago ? `${verb}${by} · ${ago}` : `${verb}${by}`
}

/** `6 items to add from this build's changes` — the seed button's promise. */
export function seedLabel(seedable: number): string {
  return `Add ${seedable} from this build`
}

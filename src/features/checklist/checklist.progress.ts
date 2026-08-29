import type { ChecklistSummary } from '@/types/api'

/**
 * The two numbers both callers have: the section from the checklist's own
 * summary, the board from the pair its feed carries per environment. Nothing
 * wider is shared, so nothing wider is asked for.
 */
export interface ChecklistProgress {
  total: number
  remaining: number
}

/**
 * Items with a check on the build being viewed — passed plus failed. A FAIL is
 * tested and broken, which is a developer's problem; counting it as outstanding
 * would send QA back to retest a thing already known not to work.
 */
export function checkedCount(p: ChecklistProgress): number {
  return Math.max(0, p.total - p.remaining)
}

export function isEmpty(p: ChecklistProgress): boolean {
  return p.total <= 0
}

export function isComplete(p: ChecklistProgress): boolean {
  return p.total > 0 && p.remaining <= 0
}

/** 0–1, for the hairline meter. An empty list is 0, never a divide by zero. */
export function checkedRatio(p: ChecklistProgress): number {
  if (isEmpty(p)) return 0
  return Math.min(1, Math.max(0, checkedCount(p) / p.total))
}

/** `3 of 7 checked` — the section's headline number. */
export function progressLabel(p: ChecklistProgress): string {
  if (isEmpty(p)) return 'Nothing on the list yet'
  if (isComplete(p)) return p.total === 1 ? 'Checked' : `All ${p.total} checked`
  return `${checkedCount(p)} of ${p.total} checked`
}

/**
 * The board's version, which has one column and no room for a sentence. Null
 * when there is nothing worth a column at all.
 */
export function boardLabel(p: ChecklistProgress | null | undefined): string | null {
  if (!p || isEmpty(p)) return null
  return isComplete(p) ? `${p.total} checked` : `${p.remaining} left`
}

/** The tooltip behind that column, where the sentence does fit. */
export function boardTitle(p: ChecklistProgress | null | undefined): string | null {
  if (!p || isEmpty(p)) return null
  if (isComplete(p)) {
    return `Every checklist item has been checked on this environment's current build`
  }
  const n = p.remaining
  return `${n} checklist item${n === 1 ? '' : 's'} not yet checked on this environment's current build`
}

/**
 * Client-side summary, for the one place the server's cannot be used: an item
 * that just came back from a check mutation. Same rule as the server's, which
 * is exactly why it is here and tested rather than inlined in a component.
 */
export function summarize(
  items: readonly { check: { result: 'PASS' | 'FAIL' } | null }[],
): ChecklistSummary {
  let passed = 0
  let failed = 0
  for (const item of items) {
    if (!item.check) continue
    if (item.check.result === 'PASS') passed++
    else failed++
  }
  return { total: items.length, passed, failed, remaining: items.length - passed - failed }
}

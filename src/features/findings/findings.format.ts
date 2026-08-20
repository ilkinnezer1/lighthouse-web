import { lockHolderName } from '@/features/environments/environments.lock'
import type { Finding, FindingStatus, UserRef } from '@/types/api'

// Three states and no transitions worth naming: a finding is open, it was
// fixed, or nobody could make it happen again. Anything more is a workflow
// engine, and Jira already owns that.

export const FINDING_STATUSES: readonly FindingStatus[] = ['OPEN', 'FIXED', 'CANNOT_REPRODUCE']

export const findingStatusLabel: Record<FindingStatus, string> = {
  OPEN: 'Open',
  FIXED: 'Fixed',
  CANNOT_REPRODUCE: "Can't reproduce",
}

// Open is the only state you would act on, so it is the only one that carries a
// hue — the same rule the deployment list follows to stay scannable.
export const findingDotClass: Record<FindingStatus, string> = {
  OPEN: 'bg-signal-error',
  FIXED: 'bg-signal-idle',
  CANNOT_REPRODUCE: 'bg-signal-idle',
}

export const findingTextClass: Record<FindingStatus, string> = {
  OPEN: 'text-signal-error',
  FIXED: 'text-ink-3',
  CANNOT_REPRODUCE: 'text-ink-4',
}

export function isOpen(finding: Pick<Finding, 'status'>): boolean {
  return finding.status === 'OPEN'
}

export function openCount(findings: readonly Finding[] | null | undefined): number {
  return findings?.filter(isOpen).length ?? 0
}

/** displayName → username → email, shared with the lock badge. */
export function personName(user: UserRef | null | undefined): string {
  return user ? lockHolderName(user) : 'Unknown'
}

/** `Aysel · 2d ago` — who filed it, under the title. */
export function filedLine(finding: Pick<Finding, 'reportedBy'>, ago: string): string {
  const who = personName(finding.reportedBy)
  return ago ? `${who} · ${ago}` : who
}

/** `Fixed by Ada · 3h ago`. Null while it is still open. */
export function resolutionLine(
  finding: Pick<Finding, 'status' | 'resolvedBy'>,
  ago: string,
): string | null {
  if (finding.status === 'OPEN') return null
  const verb = finding.status === 'FIXED' ? 'Fixed' : "Closed as can't-reproduce"
  const by = finding.resolvedBy ? ` by ${personName(finding.resolvedBy)}` : ''
  return ago ? `${verb}${by} · ${ago}` : `${verb}${by}`
}

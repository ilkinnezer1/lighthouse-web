import type { AppNotification, NotificationContext } from '@/types/api'
import { failureReason } from '@/features/deployments/failureReason'

// A row has to read as a sentence, so the headline is derived from `kind` +
// `context` rather than shown verbatim. The server's `title` is the fallback,
// which is what lets the API ship a new kind before the web knows about it.

export type InboxTone = 'ok' | 'warn' | 'error'

const TONES: Record<string, InboxTone> = {
  'deploy.succeeded': 'ok',
  'deploy.failed': 'error',
  'deploy.cancelled': 'warn',
  'deploy.skipped_locked': 'warn',
  'lock.overridden': 'warn',
  'database.provision_failed': 'error',
  'database.snapshot_failed': 'error',
  'finding.created': 'warn',
  'finding.resolved': 'ok',
}

// Only the two that genuinely interrupt. A tray that toasts every event trains
// people to dismiss without reading, and then these two get dismissed too.
const INTERRUPTING = new Set(['deploy.failed', 'lock.overridden'])

export function notificationTone(kind: string): InboxTone {
  return TONES[kind] ?? 'warn'
}

export function interrupts(n: AppNotification): boolean {
  return INTERRUPTING.has(n.kind)
}

export function isUnread(n: AppNotification): boolean {
  return n.readAt === null
}

export function unreadIn(items: AppNotification[]): boolean {
  return items.some(isUnread)
}

/** Where a build actually happened: the environment, else the project. */
export function subjectLabel(context: NotificationContext | null): string | null {
  return context?.environmentName?.trim() || context?.projectName?.trim() || null
}

/**
 * Groups key off this rather than the label, so two environments that happen to
 * share a name never merge. Null means "ungroupable" — those never merge.
 */
export function subjectKey(context: NotificationContext | null): string | null {
  if (context?.environmentId) return `env:${context.environmentId}`
  if (context?.projectId) return `project:${context.projectId}`
  const label = subjectLabel(context)
  return label ? `name:${label}` : null
}

export function shortSha(sha: string | null | undefined): string | null {
  const trimmed = sha?.trim()
  return trimmed ? trimmed.slice(0, 7) : null
}

/** `on production` / `to production`, or nothing when there is no subject. */
function where(context: NotificationContext | null, preposition: 'on' | 'to'): string {
  const label = subjectLabel(context)
  return label ? ` ${preposition} ${label}` : ''
}

/**
 * The sentence at the top of a row. Second person throughout — the whole point
 * of the inbox is that it is addressed to you and not to a room.
 */
export function notificationHeadline(n: AppNotification): string {
  const c = n.context
  switch (n.kind) {
    case 'deploy.succeeded':
      return `Your deploy${where(c, 'to')} is live`
    case 'deploy.failed':
      return `Your deploy${where(c, 'to')} failed`
    case 'deploy.cancelled':
      return `Your deploy${where(c, 'to')} was cancelled`
    case 'deploy.skipped_locked':
      return `Your deploy${where(c, 'to')} was skipped`
    case 'lock.overridden':
      return `Your lock${where(c, 'on')} was overridden`
    case 'database.provision_failed':
      return `Your database${where(c, 'on')} failed to provision`
    case 'database.snapshot_failed':
      return `Your database snapshot${where(c, 'on')} failed`
    // Addressed to whoever deployed the build it was found on, and to whoever
    // filed it — so both read as being about your own work, not a room's.
    case 'finding.created':
      return `Someone found a bug on your deploy${where(c, 'to')}`
    case 'finding.resolved':
      return `Your finding${where(c, 'on')} was resolved`
    default:
      return n.title
  }
}

// Each kind places the subject clause itself: "3 deploys failed ON staging" but
// "your lock ON staging was overridden 3 times". Appending it uniformly reads as
// machine output for the second one.
const PLURAL: Record<string, (n: number, on: string) => string> = {
  'deploy.succeeded': (n, on) => `${n} deploys went live${on}`,
  'deploy.failed': (n, on) => `${n} deploys failed${on}`,
  'deploy.cancelled': (n, on) => `${n} deploys were cancelled${on}`,
  'deploy.skipped_locked': (n, on) => `${n} deploys were skipped${on}`,
  'lock.overridden': (n, on) => `Your lock${on} was overridden ${n} times`,
  'database.provision_failed': (n, on) => `${n} databases failed to provision${on}`,
  'database.snapshot_failed': (n, on) => `${n} database snapshots failed${on}`,
  'finding.created': (n, on) => `${n} findings were reported${on}`,
  'finding.resolved': (n, on) => `${n} of your findings${on} were resolved`,
}

/** "3 deploys failed on webhook-test-1" — one row instead of three. */
export function groupHeadline(
  kind: string,
  count: number,
  context: NotificationContext | null,
): string {
  const on = where(context, 'on')
  return PLURAL[kind]?.(count, on) ?? `${count} updates${on}`
}

/**
 * The dim line under the headline: what the sentence left out. Takes the
 * already-formatted age so the caller owns the clock and this stays pure.
 */
export function notificationMeta(n: AppNotification, ago: string): string {
  const parts: string[] = []
  // Skipped when the headline already said the project — the subject falls back
  // to the project name only when there is no environment.
  if (n.context?.environmentName && n.context.projectName) parts.push(n.context.projectName)
  const sha = shortSha(n.context?.commitSha)
  if (sha) parts.push(sha)
  if (ago) parts.push(ago)
  return parts.join(' · ')
}

/**
 * The line under a headline. A failed deploy's body is the worker's raw error,
 * so it is reduced to the classified title; an unclassified one adds nothing
 * past "failed" and is left to the deployment page.
 */
export function notificationDetail(n: AppNotification): string | null {
  if (n.kind !== 'deploy.failed') return n.body
  const reason = failureReason(n.body)
  return reason && reason.kind !== 'unknown' ? reason.title : null
}

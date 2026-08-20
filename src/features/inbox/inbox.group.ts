import type { AppNotification } from '@/types/api'
import { groupHeadline, isUnread, notificationHeadline, subjectKey } from './inbox.format'

/**
 * Collapses runs of the same thing happening to the same subject.
 *
 * Only ADJACENT items merge. The feed is newest-first, so a run is a burst —
 * which is the case worth collapsing. Merging across the whole page would let a
 * failure from Tuesday join one from today under a single "2 deploys failed",
 * and would reorder the feed to do it.
 */

export interface InboxGroup {
  /** Stable across re-groupings: the newest member's id. */
  id: string
  kind: string
  items: AppNotification[]
  headline: string
  unread: boolean
  /** Newest member's timestamp — a group sorts where its newest item sat. */
  createdAt: string
  /** Set only for a single-item group; a burst has no one destination. */
  link: string | null
}

export function groupNotifications(items: AppNotification[]): InboxGroup[] {
  const groups: InboxGroup[] = []
  let run: AppNotification[] = []

  const flush = () => {
    if (run.length === 0) return
    groups.push(toGroup(run))
    run = []
  }

  for (const item of items) {
    if (run.length > 0 && !mergeable(run[0], item)) flush()
    run.push(item)
  }
  flush()

  return groups
}

function mergeable(a: AppNotification, b: AppNotification): boolean {
  if (a.kind !== b.kind) return false
  const key = subjectKey(a.context)
  // No identifiable subject means nothing to group BY, so it stays its own row.
  return key !== null && key === subjectKey(b.context)
}

function toGroup(run: AppNotification[]): InboxGroup {
  const newest = run[0]
  const single = run.length === 1
  return {
    id: newest.id,
    kind: newest.kind,
    items: run,
    headline: single
      ? notificationHeadline(newest)
      : groupHeadline(newest.kind, run.length, newest.context),
    unread: run.some(isUnread),
    createdAt: newest.createdAt,
    link: single ? newest.link : null,
  }
}

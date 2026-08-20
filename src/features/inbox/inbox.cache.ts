import type { InfiniteData } from '@tanstack/vue-query'
import type { AppNotification, NotificationFeedPage } from '@/types/api'

/**
 * The feed is written to directly rather than invalidated, because the count in
 * the header has to be exact: a refetch would blink the badge, and a live
 * arrival while the panel is open would reorder rows under the cursor.
 *
 * `unreadCount` is server-authoritative — every mutation and the socket payload
 * carry the new one, so it is never incremented locally and cannot drift.
 * It lives on page 0 alone; the other pages' copies are ignored as stale.
 */
export type InboxFeed = InfiniteData<NotificationFeedPage, string>

export function feedItems(feed: InboxFeed | undefined): AppNotification[] {
  return feed?.pages.flatMap((p) => p.items) ?? []
}

export function feedUnreadCount(feed: InboxFeed | undefined): number {
  return feed?.pages[0]?.unreadCount ?? 0
}

function withUnreadCount(feed: InboxFeed, unreadCount: number): InboxFeed {
  return {
    ...feed,
    pages: feed.pages.map((page, i) => (i === 0 ? { ...page, unreadCount } : page)),
  }
}

function mapItems(
  feed: InboxFeed,
  fn: (n: AppNotification) => AppNotification,
): NotificationFeedPage[] {
  return feed.pages.map((page) => ({ ...page, items: page.items.map(fn) }))
}

/**
 * A socket arrival. Replaces in place when the id is already held — a refetch
 * racing the push would otherwise show the same notification twice.
 */
export function receiveNotification(
  feed: InboxFeed | undefined,
  notification: AppNotification,
  unreadCount: number,
): InboxFeed | undefined {
  // Nothing cached means nothing is mounted to read it; the next fetch is
  // authoritative and inventing a page here would strand it with no cursor.
  if (!feed || feed.pages.length === 0) return feed

  const known = feed.pages.some((page) => page.items.some((n) => n.id === notification.id))
  if (known) {
    return withUnreadCount(
      { ...feed, pages: mapItems(feed, (n) => (n.id === notification.id ? notification : n)) },
      unreadCount,
    )
  }

  const [first, ...rest] = feed.pages
  return {
    ...feed,
    pages: [{ ...first, items: [notification, ...first.items], unreadCount }, ...rest],
  }
}

export function applyRead(
  feed: InboxFeed | undefined,
  ids: string[],
  unreadCount: number,
  readAt: string,
): InboxFeed | undefined {
  if (!feed) return feed
  const target = new Set(ids)
  return withUnreadCount(
    {
      ...feed,
      pages: mapItems(feed, (n) => (target.has(n.id) && !n.readAt ? { ...n, readAt } : n)),
    },
    unreadCount,
  )
}

export function applyReadAll(feed: InboxFeed | undefined, readAt: string): InboxFeed | undefined {
  if (!feed) return feed
  return withUnreadCount(
    { ...feed, pages: mapItems(feed, (n) => (n.readAt ? n : { ...n, readAt })) },
    0,
  )
}

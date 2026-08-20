import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed } from 'vue'
import { useCursorFeed } from '@/lib/feed'
import { listNotifications, markAllNotificationsRead, markNotificationRead } from './inbox.api'
import {
  applyRead,
  applyReadAll,
  feedUnreadCount,
  receiveNotification,
  type InboxFeed,
} from './inbox.cache'
import type { AppNotification } from '@/types/api'

export const inboxKeys = {
  feed: ['notifications', 'feed'] as const,
}

const PAGE_SIZE = 30

/** No `refetchInterval`: the socket is the transport, polling would duplicate it. */
export function useNotificationFeed() {
  const query = useCursorFeed<AppNotification>({
    queryKey: inboxKeys.feed,
    fetchPage: (cursor) => listNotifications(cursor, PAGE_SIZE),
  })
  const unreadCount = computed(() => feedUnreadCount(query.data.value as InboxFeed | undefined))
  return Object.assign(query, { unreadCount })
}

function useFeedWriter() {
  const qc = useQueryClient()
  return (fn: (feed: InboxFeed | undefined) => InboxFeed | undefined) =>
    qc.setQueryData<InboxFeed>(inboxKeys.feed, fn)
}

/** Called by the socket listener; exposed here so the cache shape stays in one place. */
export function useReceiveNotification() {
  const write = useFeedWriter()
  return (notification: AppNotification, unreadCount: number) =>
    write((feed) => receiveNotification(feed, notification, unreadCount))
}

/**
 * Takes every id in a row, so collapsing three failures into one line and
 * clicking it does not leave two of them unread behind the group.
 */
export function useMarkRead() {
  const write = useFeedWriter()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.all(ids.map(markNotificationRead))
      return results[results.length - 1]?.unreadCount ?? 0
    },
    onMutate: (ids) => {
      // Optimistic: the row must dim on click, not a round trip later.
      write((feed) => applyRead(feed, ids, Math.max(0, feedUnreadCount(feed) - ids.length), now()))
    },
    onSuccess: (unreadCount, ids) => write((feed) => applyRead(feed, ids, unreadCount, now())),
  })
}

export function useMarkAllRead() {
  const write = useFeedWriter()
  return useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => write((feed) => applyReadAll(feed, now())),
  })
}

function now() {
  return new Date().toISOString()
}

import { onScopeDispose, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import { getNotificationsSocket } from '@/lib/socket'
import { interrupts, notificationHeadline, notificationTone } from './inbox.format'
import { inboxKeys, useMarkRead, useReceiveNotification } from './inbox.queries'
import type { NotificationCreatedEvent } from '@/types/api'

/**
 * Keeps the inbox live. Mounted once, by the header bell, so the count and the
 * toasts work on every page rather than only where the panel is open.
 */
export function useInboxLive() {
  const router = useRouter()
  const qc = useQueryClient()
  const receive = useReceiveNotification()
  const markRead = useMarkRead()
  const connected = ref(false)

  // A dropped socket misses pushes silently, so a reconnect refetches rather
  // than trusting a cache that may have a hole in it. The first connect is not
  // a reconnect — the query is already fetching.
  let everConnected = false

  const onConnect = () => {
    connected.value = true
    if (everConnected) void qc.invalidateQueries({ queryKey: inboxKeys.feed })
    everConnected = true
  }
  const onDisconnect = () => {
    connected.value = false
  }

  const onCreated = (event: NotificationCreatedEvent) => {
    const { notification, unreadCount } = event
    receive(notification, unreadCount)
    if (!interrupts(notification)) return

    const notify = notificationTone(notification.kind) === 'error' ? toast.error : toast.warning
    notify(notificationHeadline(notification), {
      description: notification.body ?? undefined,
      action: notification.link
        ? {
            label: 'View',
            onClick: () => {
              markRead.mutate([notification.id])
              void router.push(notification.link!)
            },
          }
        : undefined,
    })
  }

  const socket = getNotificationsSocket()
  socket.on('connect', onConnect)
  socket.on('disconnect', onDisconnect)
  socket.on('notification.created', onCreated)
  if (socket.connected) onConnect()

  onScopeDispose(() => {
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
    socket.off('notification.created', onCreated)
  })

  return { connected }
}

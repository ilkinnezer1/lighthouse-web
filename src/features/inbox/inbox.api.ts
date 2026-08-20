import { api } from '@/lib/api'
import type { NotificationFeedPage } from '@/types/api'

export async function listNotifications(cursor?: string, limit?: number) {
  const { data } = await api.get<NotificationFeedPage>('/me/notifications', {
    params: { cursor, limit },
  })
  return data
}

// Both mutations answer with the new unread count so the badge settles without
// a refetch.
export async function markNotificationRead(id: string) {
  const { data } = await api.post<{ unreadCount: number }>(`/me/notifications/${id}/read`)
  return data
}

export async function markAllNotificationsRead() {
  const { data } = await api.post<{ unreadCount: number }>('/me/notifications/read-all')
  return data
}

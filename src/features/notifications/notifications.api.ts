import { api } from '@/lib/api'
import type {
  CreateNotificationChannelInput,
  NotificationChannel,
  UpdateNotificationChannelInput,
} from '@/types/api'

export async function listNotificationChannels(orgId: string) {
  const { data } = await api.get<{ channels: NotificationChannel[]; events: string[] }>(
    `/orgs/${orgId}/notification-channels`,
  )
  return data
}

export async function createNotificationChannel(
  orgId: string,
  input: CreateNotificationChannelInput,
) {
  const { data } = await api.post<NotificationChannel>(
    `/orgs/${orgId}/notification-channels`,
    input,
  )
  return data
}

export async function updateNotificationChannel(
  orgId: string,
  id: string,
  input: UpdateNotificationChannelInput,
) {
  const { data } = await api.patch<NotificationChannel>(
    `/orgs/${orgId}/notification-channels/${id}`,
    input,
  )
  return data
}

export async function deleteNotificationChannel(orgId: string, id: string) {
  await api.delete(`/orgs/${orgId}/notification-channels/${id}`)
}

export async function testNotificationChannel(orgId: string, id: string) {
  const { data } = await api.post<{ ok: boolean; error?: string }>(
    `/orgs/${orgId}/notification-channels/${id}/test`,
  )
  return data
}

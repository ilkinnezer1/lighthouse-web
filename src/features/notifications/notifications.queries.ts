import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createNotificationChannel,
  deleteNotificationChannel,
  listNotificationChannels,
  testNotificationChannel,
  updateNotificationChannel,
} from './notifications.api'
import type {
  CreateNotificationChannelInput,
  UpdateNotificationChannelInput,
} from '@/types/api'

export const notificationKeys = {
  byOrg: (orgId: string) => ['notification-channels', orgId] as const,
}

export function useNotificationChannels(orgId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => notificationKeys.byOrg(toValue(orgId))),
    queryFn: () => listNotificationChannels(toValue(orgId)),
  })
}

function useInvalidate(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: notificationKeys.byOrg(toValue(orgId)) })
}

export function useCreateNotificationChannel(orgId: MaybeRefOrGetter<string>) {
  const invalidate = useInvalidate(orgId)
  return useMutation({
    mutationFn: (input: CreateNotificationChannelInput) =>
      createNotificationChannel(toValue(orgId), input),
    onSuccess: invalidate,
  })
}

export function useUpdateNotificationChannel(orgId: MaybeRefOrGetter<string>) {
  const invalidate = useInvalidate(orgId)
  return useMutation({
    mutationFn: (args: { id: string; input: UpdateNotificationChannelInput }) =>
      updateNotificationChannel(toValue(orgId), args.id, args.input),
    onSuccess: invalidate,
  })
}

export function useDeleteNotificationChannel(orgId: MaybeRefOrGetter<string>) {
  const invalidate = useInvalidate(orgId)
  return useMutation({
    mutationFn: (id: string) => deleteNotificationChannel(toValue(orgId), id),
    onSuccess: invalidate,
  })
}

export function useTestNotificationChannel(orgId: MaybeRefOrGetter<string>) {
  return useMutation({
    mutationFn: (id: string) => testNotificationChannel(toValue(orgId), id),
  })
}

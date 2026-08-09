import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { CreateBackupScheduleInput, UpdateBackupScheduleInput } from '@/types/api'
import {
  createBackupSchedule,
  deleteBackupSchedule,
  listBackupSchedules,
  updateBackupSchedule,
} from './schedules.api'

export const scheduleKeys = {
  byEnv: (envId: string) => ['backup-schedules', envId] as const,
}

export function useBackupSchedules(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => scheduleKeys.byEnv(toValue(envId))),
    queryFn: () => listBackupSchedules(toValue(envId)),
    enabled: computed(() => Boolean(toValue(envId))),
  })
}

export function useSaveBackupSchedule(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id?: string; input: CreateBackupScheduleInput }) =>
      vars.id
        ? updateBackupSchedule(vars.id, vars.input as UpdateBackupScheduleInput)
        : createBackupSchedule(toValue(envId), vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.byEnv(toValue(envId)) }),
  })
}

export function useDeleteBackupSchedule(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBackupSchedule(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: scheduleKeys.byEnv(toValue(envId)) }),
  })
}

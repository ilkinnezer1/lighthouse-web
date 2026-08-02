import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type {
  CreateScheduledTaskInput,
  UpdateScheduledTaskInput,
} from '@/types/api'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import {
  createScheduledTask,
  listAllScheduledTasks,
  deleteScheduledTask,
  listScheduledTasks,
  listTaskRuns,
  runScheduledTask,
  updateScheduledTask,
} from './scheduled-tasks.api'

export const taskKeys = {
  all: ['scheduled-tasks'] as const,
  byEnv: (envId: string) => ['scheduled-tasks', 'env', envId] as const,
  runs: (id: string) => ['scheduled-tasks', id, 'runs'] as const,
}

export function useAllScheduledTasks(filters: {
  projectId?: MaybeRefOrGetter<string | undefined>
  enabled?: MaybeRefOrGetter<boolean | undefined>
}) {
  const active = useActiveOrgStore()
  return useQuery({
    queryKey: computed(() => [
      ...taskKeys.all,
      'all',
      active.activeOrgId,
      toValue(filters.projectId) ?? null,
      toValue(filters.enabled) ?? null,
    ]),
    queryFn: () =>
      listAllScheduledTasks({
        orgId: active.activeOrgId ?? undefined,
        projectId: toValue(filters.projectId),
        enabled: toValue(filters.enabled),
      }),
  })
}

export function useScheduledTasks(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => taskKeys.byEnv(toValue(envId))),
    queryFn: () => listScheduledTasks(toValue(envId)),
  })
}

export function useTaskRuns(
  id: MaybeRefOrGetter<string>,
  opts?: { enabled?: MaybeRefOrGetter<boolean> },
) {
  return useQuery({
    queryKey: computed(() => taskKeys.runs(toValue(id))),
    queryFn: () => listTaskRuns(toValue(id)),
    enabled: computed(() => toValue(opts?.enabled) ?? true),
  })
}

export function useCreateScheduledTask(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateScheduledTaskInput) =>
      createScheduledTask(toValue(envId), input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: taskKeys.byEnv(toValue(envId)) }),
  })
}

export function useUpdateScheduledTask(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; input: UpdateScheduledTaskInput }) =>
      updateScheduledTask(vars.id, vars.input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: taskKeys.byEnv(toValue(envId)) }),
  })
}

export function useDeleteScheduledTask(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteScheduledTask(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: taskKeys.byEnv(toValue(envId)) }),
  })
}

export function useRunScheduledTask(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => runScheduledTask(id),
    onSuccess: (_res, id) => {
      qc.invalidateQueries({ queryKey: taskKeys.byEnv(toValue(envId)) })
      qc.invalidateQueries({ queryKey: taskKeys.runs(id) })
    },
  })
}

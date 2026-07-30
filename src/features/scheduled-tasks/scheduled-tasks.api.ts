import { api } from '@/lib/api'
import type {
  CreateScheduledTaskInput,
  ScheduledTask,
  TaskRun,
  TaskRunOutcome,
  UpdateScheduledTaskInput,
} from '@/types/api'

export async function listScheduledTasks(envId: string) {
  const { data } = await api.get<ScheduledTask[]>(
    `/environments/${envId}/scheduled-tasks`,
  )
  return data
}

export async function createScheduledTask(
  envId: string,
  input: CreateScheduledTaskInput,
) {
  const { data } = await api.post<ScheduledTask>(
    `/environments/${envId}/scheduled-tasks`,
    input,
  )
  return data
}

export async function updateScheduledTask(
  id: string,
  input: UpdateScheduledTaskInput,
) {
  const { data } = await api.patch<ScheduledTask>(`/scheduled-tasks/${id}`, input)
  return data
}

export async function deleteScheduledTask(id: string) {
  await api.delete(`/scheduled-tasks/${id}`)
}

export async function listTaskRuns(id: string) {
  const { data } = await api.get<TaskRun[]>(`/scheduled-tasks/${id}/runs`)
  return data
}

export async function runScheduledTask(id: string) {
  const { data } = await api.post<TaskRunOutcome>(`/scheduled-tasks/${id}/run`)
  return data
}

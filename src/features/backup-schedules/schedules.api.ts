import { api } from '@/lib/api'
import type {
  BackupSchedule,
  CreateBackupScheduleInput,
  UpdateBackupScheduleInput,
} from '@/types/api'

export async function listBackupSchedules(envId: string) {
  const { data } = await api.get<BackupSchedule[]>(`/environments/${envId}/backup-schedules`)
  return data
}

export async function createBackupSchedule(envId: string, input: CreateBackupScheduleInput) {
  const { data } = await api.post<BackupSchedule>(
    `/environments/${envId}/backup-schedules`,
    input,
  )
  return data
}

export async function updateBackupSchedule(id: string, input: UpdateBackupScheduleInput) {
  const { data } = await api.patch<BackupSchedule>(`/backup-schedules/${id}`, input)
  return data
}

export async function deleteBackupSchedule(id: string) {
  await api.delete(`/backup-schedules/${id}`)
}

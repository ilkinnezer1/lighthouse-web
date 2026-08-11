import { api } from '@/lib/api'
import type { VolumeBackup } from '@/types/api'

export async function listVolumeBackups(envId: string) {
  const { data } = await api.get<VolumeBackup[]>(`/environments/${envId}/volume-backups`)
  return data
}

export async function createVolumeBackup(envId: string, volumeName: string) {
  const { data } = await api.post<VolumeBackup>(`/environments/${envId}/volume-backups`, {
    volumeName,
  })
  return data
}

export async function restoreVolumeBackup(backupId: string) {
  await api.post(`/volume-backups/${backupId}/restore`)
}

export async function updateVolumeBackup(
  backupId: string,
  input: { label?: string; isBaseline?: boolean },
) {
  const { data } = await api.patch<VolumeBackup>(`/volume-backups/${backupId}`, input)
  return data
}

export async function deleteVolumeBackup(backupId: string) {
  await api.delete(`/volume-backups/${backupId}`)
}

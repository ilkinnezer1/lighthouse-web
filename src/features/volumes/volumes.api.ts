import { api } from '@/lib/api'
import type { VolumeInfo } from '@/types/api'

export async function listVolumes(envId: string) {
  const { data } = await api.get<{ volumes: VolumeInfo[] }>(`/environments/${envId}/volumes`)
  return data.volumes
}

export async function deleteVolume(envId: string, name: string) {
  await api.delete(`/environments/${envId}/volumes/${encodeURIComponent(name)}`)
}

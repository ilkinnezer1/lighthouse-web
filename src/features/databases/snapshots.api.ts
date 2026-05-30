import { api } from '@/lib/api'
import type { DatabaseSnapshot } from '@/types/api'

export async function listSnapshots(databaseId: string) {
  const { data } = await api.get<DatabaseSnapshot[]>(`/databases/${databaseId}/snapshots`)
  return data
}

export async function createSnapshot(databaseId: string) {
  const { data } = await api.post<DatabaseSnapshot>(`/databases/${databaseId}/snapshots`)
  return data
}

export async function restoreSnapshot(id: string) {
  await api.post(`/snapshots/${id}/restore`)
}

export async function deleteSnapshot(id: string) {
  await api.delete(`/snapshots/${id}`)
}

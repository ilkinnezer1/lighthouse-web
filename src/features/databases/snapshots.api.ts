import { api } from '@/lib/api'
import type { DatabaseSnapshot, EnvironmentResetResult } from '@/types/api'

export async function listSnapshots(databaseId: string) {
  const { data } = await api.get<DatabaseSnapshot[]>(`/databases/${databaseId}/snapshots`)
  return data
}

export async function createSnapshot(databaseId: string) {
  const { data } = await api.post<DatabaseSnapshot>(`/databases/${databaseId}/snapshots`)
  return data
}

export async function importDump(
  databaseId: string,
  file: File,
  opts: { onProgress?: (loaded: number, total: number) => void; signal?: AbortSignal } = {},
) {
  const { data } = await api.post<DatabaseSnapshot>(`/databases/${databaseId}/imports`, file, {
    // fetch exposes no upload progress; the XHR adapter does.
    adapter: 'xhr',
    signal: opts.signal,
    headers: {
      'Content-Type': 'application/octet-stream',
      'X-Import-Filename': encodeURIComponent(file.name),
    },
    onUploadProgress: (e) => opts.onProgress?.(e.loaded, e.total ?? file.size),
  })
  return data
}

export async function restoreSnapshot(id: string) {
  await api.post(`/snapshots/${id}/restore`)
}

export async function deleteSnapshot(id: string) {
  await api.delete(`/snapshots/${id}`)
}

export async function updateSnapshot(id: string, input: { label?: string; isBaseline?: boolean }) {
  const { data } = await api.patch<DatabaseSnapshot>(`/snapshots/${id}`, input)
  return data
}

export async function resetEnvironment(envId: string) {
  const { data } = await api.post<EnvironmentResetResult>(`/environments/${envId}/reset`)
  return data
}

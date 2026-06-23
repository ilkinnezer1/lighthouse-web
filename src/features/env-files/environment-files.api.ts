import { api } from '@/lib/api'
import type {
  ManagedFile,
  ProjectFileContent,
  ProjectFileEntry,
  SaveManagedFileInput,
} from '@/types/api'

export async function listEnvironmentFiles(envId: string) {
  const { data } = await api.get<{ files: ManagedFile[] }>(`/environments/${envId}/files`)
  return data.files
}

export async function saveEnvironmentFile(envId: string, input: SaveManagedFileInput) {
  const { data } = await api.put<ManagedFile>(`/environments/${envId}/files`, input)
  return data
}

export async function deleteEnvironmentFile(envId: string, path: string) {
  await api.delete<{ ok: true }>(`/environments/${envId}/files`, { params: { path } })
}

export async function getFileTree(envId: string) {
  const { data } = await api.get<{ entries: ProjectFileEntry[]; truncated?: boolean }>(
    `/environments/${envId}/files/tree`,
  )
  return data
}

export async function getFileContent(envId: string, path: string) {
  const { data } = await api.get<ProjectFileContent>(`/environments/${envId}/files/content`, {
    params: { path },
  })
  return data
}

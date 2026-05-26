import { api } from '@/lib/api'
import type { CreateDatabaseInput, ManagedDatabase } from '@/types/api'

export async function listDatabases(envId: string) {
  const { data } = await api.get<ManagedDatabase[]>(`/environments/${envId}/databases`)
  return data
}

export async function getDatabase(id: string) {
  const { data } = await api.get<ManagedDatabase>(`/databases/${id}`)
  return data
}

export async function createDatabase(envId: string, input: CreateDatabaseInput) {
  const { data } = await api.post<ManagedDatabase>(`/environments/${envId}/databases`, input)
  return data
}

export async function deleteDatabase(id: string) {
  await api.delete(`/databases/${id}`)
}

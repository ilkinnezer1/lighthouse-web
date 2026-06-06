import { api } from '@/lib/api'
import type { EnvVar, SetEnvVarsInput } from '@/types/api'

export async function listEnvVars(envId: string) {
  const { data } = await api.get<EnvVar[]>(`/environments/${envId}/env-vars`)
  return data
}

export async function replaceEnvVars(envId: string, input: SetEnvVarsInput) {
  const { data } = await api.put<EnvVar[]>(`/environments/${envId}/env-vars`, input)
  return data
}

export async function mergeEnvVars(envId: string, input: SetEnvVarsInput) {
  const { data } = await api.patch<EnvVar[]>(`/environments/${envId}/env-vars`, input)
  return data
}

export async function deleteEnvVar(envId: string, key: string) {
  const { data } = await api.delete<EnvVar[]>(
    `/environments/${envId}/env-vars/${encodeURIComponent(key)}`,
  )
  return data
}

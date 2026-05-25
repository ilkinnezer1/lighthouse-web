import { api } from '@/lib/api'
import type { Deployment } from '@/types/api'

export async function listDeployments(envId: string) {
  const { data } = await api.get<Deployment[]>(`/environments/${envId}/deployments`)
  return data
}

export async function getDeployment(id: string) {
  const { data } = await api.get<Deployment>(`/deployments/${id}`)
  return data
}

export async function createDeployment(envId: string) {
  const { data } = await api.post<Deployment>(`/environments/${envId}/deployments`)
  return data
}

export async function cancelDeployment(id: string) {
  await api.post(`/deployments/${id}/cancel`)
}

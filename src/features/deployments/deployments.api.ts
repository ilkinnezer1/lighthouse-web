import { api } from '@/lib/api'
import type {
  CreateDeploymentInput,
  Deployment,
  DeploymentListPage,
  ListDeploymentsParams,
} from '@/types/api'

export async function listDeployments(envId: string) {
  const { data } = await api.get<Deployment[]>(`/environments/${envId}/deployments`)
  return data
}

export async function listAllDeployments(params?: ListDeploymentsParams) {
  const { data } = await api.get<DeploymentListPage>('/deployments', { params })
  return data
}

export async function getDeployment(id: string) {
  const { data } = await api.get<Deployment>(`/deployments/${id}`)
  return data
}

export async function createDeployment(envId: string, input?: CreateDeploymentInput) {
  const { data } = await api.post<Deployment>(`/environments/${envId}/deployments`, input)
  return data
}

export async function cancelDeployment(id: string) {
  await api.post(`/deployments/${id}/cancel`)
}

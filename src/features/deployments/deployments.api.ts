import { api } from '@/lib/api'
import type {
  CreateDeploymentInput,
  Deployment,
  DeploymentListPage,
  ListDeploymentsParams,
  MaintenanceActionDef,
  ServiceHealth,
  ServiceStats,
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

export async function redeployDeployment(id: string) {
  const { data } = await api.post<Deployment>(`/deployments/${id}/redeploy`)
  return data
}

export async function rollbackDeployment(id: string) {
  const { data } = await api.post<Deployment>(`/deployments/${id}/rollback`)
  return data
}

export type ServiceAction = 'start' | 'stop' | 'restart'

export interface ServiceActionResult {
  service: string
  action: ServiceAction
  state: string
}

export async function actOnService(
  deploymentId: string,
  name: string,
  action: ServiceAction,
) {
  const { data } = await api.post<ServiceActionResult>(
    `/deployments/${deploymentId}/services/${encodeURIComponent(name)}/${action}`,
  )
  return data
}

export async function getServiceStats(deploymentId: string, service: string) {
  const { data } = await api.get<ServiceStats>(
    `/deployments/${deploymentId}/services/${encodeURIComponent(service)}/stats`,
  )
  return data
}

export async function getServiceHealth(deploymentId: string, service: string) {
  const { data } = await api.get<ServiceHealth>(
    `/deployments/${deploymentId}/services/${encodeURIComponent(service)}/health`,
  )
  return data
}

export async function getDeploymentActions(deploymentId: string) {
  const { data } = await api.get<{ actions: MaintenanceActionDef[] }>(
    `/deployments/${deploymentId}/actions`,
  )
  return data.actions
}

// Triggers a maintenance action and returns the raw streaming Response — axios
// can't stream a body, so callers read `res.body` directly (like runtime logs).
export function runDeploymentAction(
  deploymentId: string,
  actionId: string,
  signal: AbortSignal,
) {
  return fetch(
    `/api/deployments/${deploymentId}/actions/${encodeURIComponent(actionId)}`,
    {
      method: 'POST',
      credentials: 'include',
      signal,
      headers: { Accept: 'text/plain' },
    },
  )
}

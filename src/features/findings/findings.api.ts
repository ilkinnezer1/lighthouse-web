import { api } from '@/lib/api'
import type {
  CreateFindingInput,
  Finding,
  FindingDetail,
  FindingStatus,
  UpdateFindingInput,
} from '@/types/api'

// Findings are low-volume by nature — the lists are plain arrays, server-capped
// and newest first. No cursor, no feed.

export async function listDeploymentFindings(deploymentId: string) {
  const { data } = await api.get<Finding[]>(`/deployments/${deploymentId}/findings`)
  return data
}

export async function listEnvironmentFindings(envId: string, status?: FindingStatus) {
  const { data } = await api.get<Finding[]>(`/environments/${envId}/findings`, {
    params: status ? { status } : undefined,
  })
  return data
}

/** The only response carrying the log snapshot text; the lists omit it. */
export async function getFinding(id: string) {
  const { data } = await api.get<FindingDetail>(`/findings/${id}`)
  return data
}

// Filed against a build, never against an environment: the moment you can pick
// an environment you are back to "it's broken on staging".
export async function createFinding(deploymentId: string, input: CreateFindingInput) {
  const { data } = await api.post<Finding>(`/deployments/${deploymentId}/findings`, input)
  return data
}

export async function updateFinding(id: string, input: UpdateFindingInput) {
  const { data } = await api.patch<Finding>(`/findings/${id}`, input)
  return data
}

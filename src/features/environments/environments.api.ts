import { api } from '@/lib/api'
import type {
  EnvironmentLock,
  EnvironmentListPage,
  EnvironmentType,
  LockEnvironmentInput,
} from '@/types/api'

export async function listAllEnvironments(params: {
  cursor?: string
  orgId?: string
  projectId?: string
  type?: EnvironmentType
  active?: boolean
  limit?: number
}): Promise<EnvironmentListPage> {
  const { data } = await api.get<EnvironmentListPage>('/environments', {
    params: {
      ...(params.cursor ? { cursor: params.cursor } : {}),
      ...(params.orgId ? { orgId: params.orgId } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
      ...(params.type ? { type: params.type } : {}),
      ...(params.active === undefined ? {} : { active: String(params.active) }),
      limit: params.limit ?? 30,
    },
  })
  return data
}

export async function lockEnvironment(
  envId: string,
  input: LockEnvironmentInput = {},
): Promise<EnvironmentLock> {
  const { data } = await api.post<EnvironmentLock>(`/environments/${envId}/lock`, input)
  return data
}

export async function unlockEnvironment(envId: string): Promise<void> {
  await api.delete(`/environments/${envId}/lock`)
}

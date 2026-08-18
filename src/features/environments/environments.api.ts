import { api } from '@/lib/api'
import type { EnvironmentListPage, EnvironmentType } from '@/types/api'

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

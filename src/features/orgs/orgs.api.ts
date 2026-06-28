import { api } from '@/lib/api'
import type { OrgMember, OrgRole, OrgSummary, Organization } from '@/types/api'

export async function listOrgs() {
  const { data } = await api.get<Organization[]>('/orgs')
  return data
}

export async function createOrg(name: string) {
  const { data } = await api.post<OrgSummary>('/orgs', { name })
  return data
}

export async function renameOrg(id: string, name: string) {
  const { data } = await api.patch<OrgSummary>(`/orgs/${id}`, { name })
  return data
}

export async function deleteOrg(id: string) {
  await api.delete(`/orgs/${id}`)
}

export async function listMembers(orgId: string) {
  const { data } = await api.get<OrgMember[]>(`/orgs/${orgId}/members`)
  return data
}

export async function changeMemberRole(orgId: string, userId: string, role: OrgRole) {
  await api.patch(`/orgs/${orgId}/members/${userId}`, { role })
}

export async function removeMember(orgId: string, userId: string) {
  await api.delete(`/orgs/${orgId}/members/${userId}`)
}

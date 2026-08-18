import { api } from '@/lib/api'
import type { OrgJiraSettings, OrgMember, OrgRole, OrgSummary, Organization } from '@/types/api'

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

export async function getOrgJira(orgId: string) {
  const { data } = await api.get<OrgJiraSettings>(`/orgs/${orgId}/jira`)
  return data
}

// Only the cloud id travels — the server reads the site URL back from Atlassian
// so the link shown to every member is one this caller was allowed to see.
export async function setOrgJiraSite(orgId: string, cloudId: string) {
  const { data } = await api.put<{ site: { cloudId: string; url: string } }>(
    `/orgs/${orgId}/jira`,
    { cloudId },
  )
  return data
}

export async function clearOrgJiraSite(orgId: string) {
  await api.delete(`/orgs/${orgId}/jira`)
}

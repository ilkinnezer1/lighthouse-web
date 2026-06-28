import { api } from '@/lib/api'
import type {
  AcceptLinkResult,
  CreateInvitationInput,
  InviteLinkResult,
  InvitePreview,
  MyInvitation,
  OrgInvitation,
} from '@/types/api'

export async function inviteUser(orgId: string, input: CreateInvitationInput) {
  const { data } = await api.post<OrgInvitation>(`/orgs/${orgId}/invitations`, input)
  return data
}

export async function createInviteLink(orgId: string, role: OrgInvitation['role']) {
  const { data } = await api.post<InviteLinkResult>(`/orgs/${orgId}/invitations`, {
    role,
    link: true,
  })
  return data
}

export async function listOrgInvitations(orgId: string) {
  const { data } = await api.get<OrgInvitation[]>(`/orgs/${orgId}/invitations`)
  return data
}

export async function revokeInvitation(id: string) {
  await api.delete(`/invitations/${id}`)
}

export async function listMyInvitations() {
  const { data } = await api.get<MyInvitation[]>('/me/invitations')
  return data
}

export async function acceptInvitation(id: string) {
  await api.post(`/invitations/${id}/accept`)
}

export async function declineInvitation(id: string) {
  await api.post(`/invitations/${id}/decline`)
}

// `/invite/:token` is only valid when authenticated — the web routes through
// login (preserving the token) first. 404 = missing, 410 = used/expired.
export async function previewInvite(token: string) {
  const { data } = await api.get<InvitePreview>(`/invite/${token}`, { skipAuthRedirect: true })
  return data
}

export async function acceptInviteLink(token: string) {
  const { data } = await api.post<AcceptLinkResult>(`/invite/${token}/accept`)
  return data
}

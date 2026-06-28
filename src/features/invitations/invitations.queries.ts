import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { CreateInvitationInput, OrgRole } from '@/types/api'
import { orgKeys } from '@/features/orgs/orgs.queries'
import {
  acceptInvitation,
  acceptInviteLink,
  createInviteLink,
  declineInvitation,
  inviteUser,
  listMyInvitations,
  listOrgInvitations,
  revokeInvitation,
} from './invitations.api'

export const invitationKeys = {
  mine: ['invitations', 'mine'] as const,
  forOrg: (orgId: string) => ['invitations', 'org', orgId] as const,
}

// The caller's pending in-app invites (inbox). Polled gently so a freshly-sent
// invite surfaces even without the WS nudge.
export function useMyInvitations() {
  return useQuery({
    queryKey: invitationKeys.mine,
    queryFn: listMyInvitations,
    refetchInterval: 60_000,
  })
}

export function useOrgInvitations(orgId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => invitationKeys.forOrg(toValue(orgId))),
    queryFn: () => listOrgInvitations(toValue(orgId)),
  })
}

export function useInviteUser(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateInvitationInput) => inviteUser(toValue(orgId), input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: invitationKeys.forOrg(toValue(orgId)) }),
  })
}

export function useCreateInviteLink(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (role: OrgRole) => createInviteLink(toValue(orgId), role),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: invitationKeys.forOrg(toValue(orgId)) }),
  })
}

export function useRevokeInvitation(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => revokeInvitation(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: invitationKeys.forOrg(toValue(orgId)) }),
  })
}

export function useAcceptInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => acceptInvitation(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: invitationKeys.mine })
      // Accepting joins an org, so the caller's org list changes.
      qc.invalidateQueries({ queryKey: orgKeys.all })
    },
  })
}

export function useDeclineInvitation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => declineInvitation(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: invitationKeys.mine }),
  })
}

// Bind the authenticated caller to a link invite's org (single-use token).
export function useAcceptInviteLink() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (token: string) => acceptInviteLink(token),
    // Joining changes the caller's org list.
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  })
}

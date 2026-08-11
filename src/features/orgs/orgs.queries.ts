import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { OrgRole } from '@/types/api'
import {
  changeMemberRole,
  createOrg,
  deleteOrg,
  listMembers,
  listOrgs,
  removeMember,
  renameOrg,
} from './orgs.api'

export const orgKeys = {
  all: ['orgs'] as const,
  members: (orgId: string) => ['orgs', orgId, 'members'] as const,
}

export function useOrgs() {
  return useQuery({
    queryKey: orgKeys.all,
    queryFn: listOrgs,
    staleTime: 60_000,
  })
}

export function useOrgMembers(orgId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => orgKeys.members(toValue(orgId))),
    queryFn: () => listMembers(toValue(orgId)),
  })
}

export function useCreateOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => createOrg(name),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  })
}

export function useRenameOrg(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => renameOrg(toValue(orgId), name),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  })
}

export function useDeleteOrg() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (orgId: string) => deleteOrg(orgId),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.all }),
  })
}

export function useChangeMemberRole(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      changeMemberRole(toValue(orgId), userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: orgKeys.members(toValue(orgId)) }),
  })
}

export function useRemoveMember(orgId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (userId: string) => removeMember(toValue(orgId), userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: orgKeys.members(toValue(orgId)) })
      // Leaving an org drops it from the caller's list.
      void qc.invalidateQueries({ queryKey: orgKeys.all })
    },
  })
}

import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'
import { type Capability, roleCan } from './roles'
import { useActiveOrg } from './useActiveOrg'

// Cosmetic role-gating: returns whether the active membership role permits a
// capability, so the UI can hide/disable actions. The server re-checks every
// request — this never grants access, only declutters. Denies while the role is
// still loading (orgs query is cached and cheap).
export function useCan(cap: MaybeRefOrGetter<Capability>): ComputedRef<boolean> {
  const { role } = useActiveOrg()
  return computed(() => roleCan(role.value, toValue(cap)))
}

import { computed, type ComputedRef, type MaybeRefOrGetter, toValue } from 'vue'
import { type Capability, roleCan } from './roles'
import { useActiveOrg } from './useActiveOrg'

// Cosmetic role-gating: returns whether a membership role permits a capability,
// so the UI can hide/disable actions. The server re-checks every request — this
// never grants access, only declutters. Denies while the role is still loading
// (orgs query is cached and cheap).
//
// By default it gates against the *active* org. Pass `orgId` to gate against a
// specific org instead (e.g. a project's current org, which may differ from the
// active one) — an unknown/non-member org resolves to no role and denies.
export function useCan(
  cap: MaybeRefOrGetter<Capability>,
  orgId?: MaybeRefOrGetter<string | null | undefined>,
): ComputedRef<boolean> {
  const { role: activeRole, orgs } = useActiveOrg()
  const scoped = orgId !== undefined
  const role = computed(() => {
    if (!scoped) return activeRole.value
    const id = toValue(orgId)
    return id ? orgs.value?.find((o) => o.id === id)?.role : undefined
  })
  return computed(() => roleCan(role.value, toValue(cap)))
}

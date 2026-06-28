import { storeToRefs } from 'pinia'
import { computed } from 'vue'
import type { Organization } from '@/types/api'
import { useActiveOrgStore } from './active-org.store'
import { useOrgs } from './orgs.queries'

// Resolves the active organization (and the caller's role in it) by combining
// the persisted active-org id with GET /orgs. When no id is chosen, falls back
// to the personal org — the same default the API applies server-side.
export function useActiveOrg() {
  const store = useActiveOrgStore()
  const { activeOrgId } = storeToRefs(store)
  const { data: orgs, isPending } = useOrgs()

  const personalOrg = computed<Organization | undefined>(() =>
    orgs.value?.find((o) => o.isPersonal),
  )

  const activeOrg = computed<Organization | undefined>(() => {
    const list = orgs.value
    if (!list) return undefined
    const chosen = activeOrgId.value ? list.find((o) => o.id === activeOrgId.value) : undefined
    return chosen ?? personalOrg.value
  })

  const role = computed(() => activeOrg.value?.role)

  return {
    orgs,
    isPending,
    activeOrgId,
    activeOrg,
    personalOrg,
    role,
    setActiveOrg: store.setActiveOrg,
  }
}

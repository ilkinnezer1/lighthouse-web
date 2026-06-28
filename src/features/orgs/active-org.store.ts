import { useLocalStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

// The active org the dashboard is scoped to. Holds only the id (persisted to
// localStorage); `null` means "default", which the API resolves to the caller's
// personal org. The caller's role in it is derived from GET /orgs (useActiveOrg).
export const useActiveOrgStore = defineStore('active-org', () => {
  const activeOrgId = useLocalStorage<string | null>('lighthouse.activeOrgId', null)

  function setActiveOrg(id: string | null) {
    activeOrgId.value = id
  }

  // Clear on logout so a different user never inherits the previous scope.
  function reset() {
    activeOrgId.value = null
  }

  return { activeOrgId, setActiveOrg, reset }
})

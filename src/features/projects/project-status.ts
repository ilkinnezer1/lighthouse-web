import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'
import { listAllDeployments } from '@/features/deployments/deployments.api'
import { isTerminalStatus } from '@/features/deployments/deployments.status'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import type { DeploymentListItem } from '@/types/api'

// The API caps `limit` at 50 (ListDeploymentsDto @Max(50)) — asking for more 400s.
const PAGE = 50

/**
 * Live state for the projects list, from one extra request.
 *
 * The global feed is newest-first, so the first row we see for a project IS its
 * latest deployment. Projects with nothing in the first page simply report no
 * status rather than blocking the list — a per-project endpoint would be exact,
 * but this keeps the status board web-only.
 */
export function useProjectStatuses() {
  const active = useActiveOrgStore()

  const query = useQuery({
    queryKey: computed(() => ['deployments', 'latest-per-project', active.activeOrgId]),
    queryFn: () =>
      listAllDeployments({
        limit: PAGE,
        orgId: active.activeOrgId ?? undefined,
      }),
    // Keep polling only while something is still moving.
    refetchInterval: (q) =>
      (q.state.data?.items ?? []).some((d) => !isTerminalStatus(d.status)) ? 5_000 : false,
    refetchIntervalInBackground: true,
  })

  const byProject = computed(() => {
    const map = new Map<string, DeploymentListItem>()
    for (const d of query.data.value?.items ?? []) {
      const pid = d.environment.project.id
      if (!map.has(pid)) map.set(pid, d)
    }
    return map
  })

  const byEnvironment = computed(() => {
    const map = new Map<string, DeploymentListItem>()
    for (const d of query.data.value?.items ?? []) {
      if (!map.has(d.environmentId)) map.set(d.environmentId, d)
    }
    return map
  })

  const truncated = computed(() => (query.data.value?.nextCursor ?? null) !== null)

  return { byProject, byEnvironment, truncated, isPending: query.isPending }
}

import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { isTerminalStatus } from '@/features/deployments/deployments.status'
import { useCursorFeed } from '@/lib/feed'
import type { EnvironmentType } from '@/types/api'
import { listAllEnvironments } from './environments.api'

export const environmentBoardKeys = {
  all: ['environments'] as const,
}

export function useEnvironmentsFeed(filters: {
  projectId?: MaybeRefOrGetter<string | undefined>
  type?: MaybeRefOrGetter<EnvironmentType | undefined>
  active?: MaybeRefOrGetter<boolean | undefined>
}) {
  const active = useActiveOrgStore()
  return useCursorFeed({
    queryKey: computed(() => [
      ...environmentBoardKeys.all,
      'board',
      active.activeOrgId,
      toValue(filters.projectId) ?? null,
      toValue(filters.type) ?? null,
      toValue(filters.active) ?? null,
    ]),
    fetchPage: (cursor) =>
      listAllEnvironments({
        cursor,
        orgId: active.activeOrgId ?? undefined,
        projectId: toValue(filters.projectId),
        type: toValue(filters.type),
        active: toValue(filters.active),
        limit: 30,
      }),
    // Poll only while something is mid-deploy; the board is otherwise static and
    // this is the screen most likely to be left open on a second monitor.
    refetchInterval: (items) =>
      items.some((e) => e.latestDeployment && !isTerminalStatus(e.latestDeployment.status))
        ? 4000
        : false,
    refetchIntervalInBackground: true,
  })
}

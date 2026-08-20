import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { isTerminalStatus } from '@/features/deployments/deployments.status'
import { useCursorFeed } from '@/lib/feed'
import { projectKeys } from '@/features/projects/projects.queries'
import type { EnvironmentType, LockEnvironmentInput } from '@/types/api'
import { listAllEnvironments, lockEnvironment, unlockEnvironment } from './environments.api'

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

/**
 * Lock state shows on the board and on the environment page, which are two
 * different queries — so both are refetched after any change to it. A stale
 * lock is worse than no lock: it tells someone the environment is free.
 */
export function useInvalidateLockState() {
  const qc = useQueryClient()
  return (projectId?: string) => {
    void qc.invalidateQueries({ queryKey: environmentBoardKeys.all })
    void qc.invalidateQueries({
      queryKey: projectId ? projectKeys.detail(projectId) : projectKeys.all,
    })
  }
}

export function useLockEnvironment(
  envId: MaybeRefOrGetter<string>,
  projectId?: MaybeRefOrGetter<string | undefined>,
) {
  const invalidate = useInvalidateLockState()
  return useMutation({
    mutationFn: (input: LockEnvironmentInput = {}) => lockEnvironment(toValue(envId), input),
    onSuccess: () => invalidate(toValue(projectId)),
  })
}

export function useUnlockEnvironment(
  envId: MaybeRefOrGetter<string>,
  projectId?: MaybeRefOrGetter<string | undefined>,
) {
  const invalidate = useInvalidateLockState()
  return useMutation({
    mutationFn: () => unlockEnvironment(toValue(envId)),
    onSuccess: () => invalidate(toValue(projectId)),
  })
}

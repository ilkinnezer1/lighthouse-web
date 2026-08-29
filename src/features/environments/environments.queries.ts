import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { isTerminalStatus } from '@/features/deployments/deployments.status'
import { useCursorFeed } from '@/lib/feed'
import { projectKeys } from '@/features/projects/projects.queries'
import type {
  EnvironmentHibernation,
  EnvironmentListPage,
  EnvironmentType,
  LockEnvironmentInput,
  Project,
  UpdateHibernationInput,
} from '@/types/api'
import {
  hibernateEnvironment,
  listAllEnvironments,
  lockEnvironment,
  unlockEnvironment,
  updateHibernation,
  wakeEnvironment,
} from './environments.api'

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

interface BoardCache {
  pages: EnvironmentListPage[]
  pageParams: unknown[]
}

function replaceHibernation<T extends { id: string }>(
  rows: T[] | undefined,
  envId: string,
  hibernation: EnvironmentHibernation,
): T[] | undefined {
  return rows?.map((row) => (row.id === envId ? { ...row, hibernation } : row))
}

/**
 * Writes the hibernation the server just returned straight into both caches
 * that render it, then invalidates to reconcile.
 *
 * The write is what stops the badge lagging: waking is a Docker start, so the
 * refetch behind it is slow enough that a row left saying "Asleep" for a second
 * reads as a failed click. The invalidate still runs, because a sleep or wake
 * also moves deployment and service state these rows carry.
 */
export function useApplyHibernation() {
  const qc = useQueryClient()
  return (envId: string, hibernation: EnvironmentHibernation, projectId?: string) => {
    qc.setQueriesData<BoardCache>({ queryKey: environmentBoardKeys.all }, (old) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              items: replaceHibernation(page.items, envId, hibernation) ?? page.items,
            })),
          }
        : old,
    )
    if (projectId) {
      qc.setQueryData<Project>(projectKeys.detail(projectId), (old) =>
        old
          ? { ...old, environments: replaceHibernation(old.environments, envId, hibernation) }
          : old,
      )
    }
    void qc.invalidateQueries({ queryKey: environmentBoardKeys.all })
    void qc.invalidateQueries({
      queryKey: projectId ? projectKeys.detail(projectId) : projectKeys.all,
    })
  }
}

// Variables rather than a bound id, unlike the lock mutations: the board wakes
// whichever row was clicked from a single mutation, and `variables` is then
// what tells it which row is busy.
export interface HibernationTarget {
  envId: string
  projectId?: string
}

export function useUpdateHibernation() {
  const apply = useApplyHibernation()
  return useMutation({
    mutationFn: (v: HibernationTarget & { input: UpdateHibernationInput }) =>
      updateHibernation(v.envId, v.input),
    onSuccess: (hibernation, v) => apply(v.envId, hibernation, v.projectId),
  })
}

export function useWakeEnvironment() {
  const apply = useApplyHibernation()
  return useMutation({
    mutationFn: (v: HibernationTarget) => wakeEnvironment(v.envId),
    onSuccess: (result, v) => apply(v.envId, result.hibernation, v.projectId),
  })
}

export function useHibernateEnvironment() {
  const apply = useApplyHibernation()
  return useMutation({
    mutationFn: (v: HibernationTarget) => hibernateEnvironment(v.envId),
    onSuccess: (result, v) => apply(v.envId, result.hibernation, v.projectId),
  })
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { isAxiosError } from 'axios'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { useCursorFeed } from '@/lib/feed'
import type { CreateDeploymentInput, Deployment, DeploymentStatus } from '@/types/api'
import {
  actOnService,
  cancelDeployment,
  checkMerge,
  createDeployment,
  getDeployment,
  getDeploymentActions,
  getDeploymentChanges,
  getServiceHealth,
  getServiceStats,
  listAllDeployments,
  listDeployments,
  redeployDeployment,
  rollbackDeployment,
  type ServiceAction,
} from './deployments.api'
import { isTerminalStatus } from './deployments.status'

export const deploymentKeys = {
  all: ['deployments', 'all'] as const,
  byEnv: (envId: string) => ['deployments', 'env', envId] as const,
  detail: (id: string) => ['deployments', id] as const,
  changes: (id: string) => ['deployments', id, 'changes'] as const,
}

export function useAllDeployments() {
  return useQuery({
    queryKey: deploymentKeys.all,
    queryFn: () => listAllDeployments(),
    select: (page) => page.items,
  })
}

export function useDeploymentsFeed(filters: {
  status?: MaybeRefOrGetter<DeploymentStatus | undefined>
  projectId?: MaybeRefOrGetter<string | undefined>
}) {
  const active = useActiveOrgStore()
  return useCursorFeed({
    queryKey: computed(() => [
      ...deploymentKeys.all,
      'feed',
      active.activeOrgId,
      toValue(filters.status) ?? null,
      toValue(filters.projectId) ?? null,
    ]),
    fetchPage: (cursor) =>
      listAllDeployments({
        cursor,
        orgId: active.activeOrgId ?? undefined,
        status: toValue(filters.status),
        projectId: toValue(filters.projectId),
        limit: 30,
      }),
    refetchInterval: (items) => (items.some((d) => !isTerminalStatus(d.status)) ? 4000 : false),
    refetchIntervalInBackground: true,
  })
}

export function useDeployments(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => deploymentKeys.byEnv(toValue(envId))),
    queryFn: () => listDeployments(toValue(envId)),
    refetchInterval: (query) =>
      query.state.data?.some((d) => !isTerminalStatus(d.status)) ? 4000 : false,
    refetchIntervalInBackground: true,
  })
}

export function useDeployment(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => deploymentKeys.detail(toValue(id))),
    queryFn: () => getDeployment(toValue(id)),
    // Poll while the deployment is in progress; WS events also trigger refetch.
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isTerminalStatus(status) ? false : 4000
    },
    refetchIntervalInBackground: true,
  })
}

export function useDeploymentActions(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => [...deploymentKeys.detail(toValue(id)), 'actions']),
    queryFn: () => getDeploymentActions(toValue(id)),
  })
}

// A running service whose container is gone (e.g. an exited one-shot init
// container) returns 404 — give up rather than poll/retry a stat that will
// never come back; transient 5xx/network blips keep polling.
function isNotFound(err: unknown): boolean {
  return isAxiosError(err) && err.response?.status === 404
}

export function useServiceStats(
  deploymentId: MaybeRefOrGetter<string>,
  service: MaybeRefOrGetter<string>,
  opts?: { enabled?: MaybeRefOrGetter<boolean> },
) {
  return useQuery({
    queryKey: computed(() => [
      ...deploymentKeys.detail(toValue(deploymentId)),
      'stats',
      toValue(service),
    ]),
    queryFn: () => getServiceStats(toValue(deploymentId), toValue(service)),
    enabled: computed(() => toValue(opts?.enabled) ?? true),
    retry: (failureCount, err) => !isNotFound(err) && failureCount < 2,
    refetchInterval: (query) => (isNotFound(query.state.error) ? false : 4000),
  })
}

export function useServiceHealth(
  deploymentId: MaybeRefOrGetter<string>,
  service: MaybeRefOrGetter<string>,
  opts?: { enabled?: MaybeRefOrGetter<boolean> },
) {
  return useQuery({
    queryKey: computed(() => [
      ...deploymentKeys.detail(toValue(deploymentId)),
      'health',
      toValue(service),
    ]),
    queryFn: () => getServiceHealth(toValue(deploymentId), toValue(service)),
    enabled: computed(() => toValue(opts?.enabled) ?? true),
    retry: (failureCount, err) => !isNotFound(err) && failureCount < 2,
    // Container state shifts slowly — poll at a calmer cadence than stats (4s).
    refetchInterval: (query) => (isNotFound(query.state.error) ? false : 10000),
  })
}

export function useCreateDeployment(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input?: CreateDeploymentInput) => createDeployment(toValue(envId), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: deploymentKeys.byEnv(toValue(envId)) }),
  })
}

export function useCancelDeployment() {
  return useMutation({ mutationFn: (id: string) => cancelDeployment(id) })
}

function invalidateFeeds(qc: ReturnType<typeof useQueryClient>, envId: string) {
  void qc.invalidateQueries({ queryKey: deploymentKeys.byEnv(envId) })
  void qc.invalidateQueries({ queryKey: deploymentKeys.all })
}

export function useRedeployDeployment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; overrideLock?: boolean }) =>
      redeployDeployment(vars.id, vars.overrideLock ? { overrideLock: true } : undefined),
    onSuccess: (created) => invalidateFeeds(qc, created.environmentId),
  })
}

export function useRollbackDeployment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; overrideLock?: boolean }) =>
      rollbackDeployment(vars.id, vars.overrideLock ? { overrideLock: true } : undefined),
    onSuccess: (created) => invalidateFeeds(qc, created.environmentId),
  })
}

export function useServiceAction(deploymentId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ name, action }: { name: string; action: ServiceAction }) =>
      actOnService(toValue(deploymentId), name, action),
    onSuccess: (result) => {
      qc.setQueryData<Deployment>(deploymentKeys.detail(toValue(deploymentId)), (prev) =>
        prev
          ? {
              ...prev,
              services: prev.services?.map((s) =>
                s.name === result.service ? { ...s, status: result.state } : s,
              ),
            }
          : prev,
      )
    },
  })
}

/**
 * What landed since this environment's previous succeeded build. Kept out of
 * the detail query because it costs a GitHub round trip and the page is worth
 * showing before it resolves. Only meaningful once the build has a commit, so
 * it waits for one rather than asking about a deployment still being queued.
 */
export function useDeploymentChanges(
  id: MaybeRefOrGetter<string>,
  opts: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => deploymentKeys.changes(toValue(id))),
    queryFn: () => getDeploymentChanges(toValue(id)),
    enabled: computed(() => (opts.enabled === undefined ? true : toValue(opts.enabled))),
    staleTime: 60_000,
  })
}

/**
 * Dry-run the merge before spending a build on it. A mutation rather than a
 * query because it is expensive on the worker — a full fetch per call — so it
 * runs when asked, never on its own.
 */
export function useMergeCheck(envId: MaybeRefOrGetter<string>) {
  return useMutation({
    mutationFn: (body: { sourceBranch?: string; mergeBranches?: string[] }) =>
      checkMerge(toValue(envId), body),
  })
}

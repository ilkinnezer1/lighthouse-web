import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useCursorFeed } from '@/lib/feed'
import type { CreateDeploymentInput, DeploymentStatus } from '@/types/api'
import {
  cancelDeployment,
  createDeployment,
  getDeployment,
  listAllDeployments,
  listDeployments,
  redeployDeployment,
  rollbackDeployment,
} from './deployments.api'
import { isTerminalStatus } from './deployments.status'

export const deploymentKeys = {
  all: ['deployments', 'all'] as const,
  byEnv: (envId: string) => ['deployments', 'env', envId] as const,
  detail: (id: string) => ['deployments', id] as const,
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
  return useCursorFeed({
    queryKey: computed(() => [
      ...deploymentKeys.all,
      'feed',
      toValue(filters.status) ?? null,
      toValue(filters.projectId) ?? null,
    ]),
    fetchPage: (cursor) =>
      listAllDeployments({
        cursor,
        status: toValue(filters.status),
        projectId: toValue(filters.projectId),
        limit: 30,
      }),
    refetchInterval: (items) =>
      items.some((d) => !isTerminalStatus(d.status)) ? 4000 : false,
  })
}

export function useDeployments(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => deploymentKeys.byEnv(toValue(envId))),
    queryFn: () => listDeployments(toValue(envId)),
    refetchInterval: (query) =>
      query.state.data?.some((d) => !isTerminalStatus(d.status)) ? 4000 : false,
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
  })
}

export function useCreateDeployment(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input?: CreateDeploymentInput) => createDeployment(toValue(envId), input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: deploymentKeys.byEnv(toValue(envId)) }),
  })
}

export function useCancelDeployment() {
  return useMutation({ mutationFn: (id: string) => cancelDeployment(id) })
}

// Redeploy + rollback both enqueue a fresh deployment, so refresh the env list
// and global feed once the new row exists.
function invalidateFeeds(qc: ReturnType<typeof useQueryClient>, envId: string) {
  qc.invalidateQueries({ queryKey: deploymentKeys.byEnv(envId) })
  qc.invalidateQueries({ queryKey: deploymentKeys.all })
}

export function useRedeployDeployment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => redeployDeployment(id),
    onSuccess: (created) => invalidateFeeds(qc, created.environmentId),
  })
}

export function useRollbackDeployment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => rollbackDeployment(id),
    onSuccess: (created) => invalidateFeeds(qc, created.environmentId),
  })
}

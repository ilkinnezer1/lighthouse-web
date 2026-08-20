import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { environmentBoardKeys } from '@/features/environments/environments.queries'
import type { CreateFindingInput, FindingStatus, UpdateFindingInput } from '@/types/api'
import {
  createFinding,
  getFinding,
  listDeploymentFindings,
  listEnvironmentFindings,
  updateFinding,
} from './findings.api'

export const findingKeys = {
  all: ['findings'] as const,
  byDeployment: (deploymentId: string) => ['findings', 'deployment', deploymentId] as const,
  byEnvironment: (envId: string, status: FindingStatus | undefined) =>
    ['findings', 'environment', envId, status ?? 'all'] as const,
  detail: (id: string) => ['findings', 'detail', id] as const,
}

// No polling anywhere below: a finding only changes when a person changes it.

export function useDeploymentFindings(deploymentId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => findingKeys.byDeployment(toValue(deploymentId))),
    queryFn: () => listDeploymentFindings(toValue(deploymentId)),
  })
}

export function useEnvironmentFindings(
  envId: MaybeRefOrGetter<string>,
  status: MaybeRefOrGetter<FindingStatus | undefined>,
) {
  return useQuery({
    queryKey: computed(() => findingKeys.byEnvironment(toValue(envId), toValue(status))),
    queryFn: () => listEnvironmentFindings(toValue(envId), toValue(status)),
  })
}

/**
 * The single-finding fetch, for the log snapshot the lists leave out. Enabled
 * by the caller so it runs when a finding is expanded and not before.
 */
export function useFinding(
  id: MaybeRefOrGetter<string>,
  opts: { enabled?: MaybeRefOrGetter<boolean> } = {},
) {
  return useQuery({
    queryKey: computed(() => findingKeys.detail(toValue(id))),
    queryFn: () => getFinding(toValue(id)),
    enabled: computed(() => toValue(opts.enabled) ?? true),
  })
}

/**
 * A finding changes what the board says about its environment, so the board's
 * `openFindingCount` is refetched with it. A count that lags is a board saying
 * an environment is clean when it is not.
 */
function useInvalidateFindings() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: findingKeys.all })
    void qc.invalidateQueries({ queryKey: environmentBoardKeys.all })
  }
}

export function useCreateFinding(deploymentId: MaybeRefOrGetter<string>) {
  const invalidate = useInvalidateFindings()
  return useMutation({
    mutationFn: (input: CreateFindingInput) => createFinding(toValue(deploymentId), input),
    onSuccess: invalidate,
  })
}

export function useUpdateFinding() {
  const invalidate = useInvalidateFindings()
  return useMutation({
    mutationFn: (vars: { id: string } & UpdateFindingInput) =>
      updateFinding(vars.id, { status: vars.status }),
    onSuccess: invalidate,
  })
}

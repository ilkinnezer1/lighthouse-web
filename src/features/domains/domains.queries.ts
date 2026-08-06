import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { projectKeys } from '@/features/projects/projects.queries'
import { clearDomain, getDomain, setDomain } from './domains.api'

export const domainKeys = {
  byEnv: (envId: string) => ['domain', envId] as const,
}

export function useDomain(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => domainKeys.byEnv(toValue(envId))),
    queryFn: () => getDomain(toValue(envId)),
  })
}

export function useSetDomain(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (domain: string) => setDomain(toValue(envId), domain),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: domainKeys.byEnv(toValue(envId)) })
      // The deploy URL shown on the project detail page is derived from this.
      qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useClearDomain(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => clearDomain(toValue(envId)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: domainKeys.byEnv(toValue(envId)) })
      qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

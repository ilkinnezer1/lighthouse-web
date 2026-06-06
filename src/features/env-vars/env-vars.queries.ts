import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { EnvVar, SetEnvVarsInput } from '@/types/api'
import { deleteEnvVar, listEnvVars, mergeEnvVars, replaceEnvVars } from './env-vars.api'

export const envVarKeys = {
  byEnv: (envId: string) => ['env-vars', envId] as const,
}

export function useEnvVars(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => envVarKeys.byEnv(toValue(envId))),
    queryFn: () => listEnvVars(toValue(envId)),
  })
}

function useEnvVarMutation<TArgs>(
  envId: MaybeRefOrGetter<string>,
  fn: (envId: string, args: TArgs) => Promise<EnvVar[]>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: TArgs) => fn(toValue(envId), args),
    onSuccess: (data) => qc.setQueryData(envVarKeys.byEnv(toValue(envId)), data),
  })
}

export function useMergeEnvVars(envId: MaybeRefOrGetter<string>) {
  return useEnvVarMutation<SetEnvVarsInput>(envId, mergeEnvVars)
}

export function useReplaceEnvVars(envId: MaybeRefOrGetter<string>) {
  return useEnvVarMutation<SetEnvVarsInput>(envId, replaceEnvVars)
}

export function useDeleteEnvVar(envId: MaybeRefOrGetter<string>) {
  return useEnvVarMutation<string>(envId, deleteEnvVar)
}

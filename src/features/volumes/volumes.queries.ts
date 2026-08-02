import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { deleteVolume, listVolumes } from './volumes.api'

export const volumeKeys = {
  byEnv: (envId: string) => ['volumes', envId] as const,
}

export function useVolumes(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => volumeKeys.byEnv(toValue(envId))),
    queryFn: () => listVolumes(toValue(envId)),
  })
}

export function useDeleteVolume(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => deleteVolume(toValue(envId), name),
    onSuccess: () => qc.invalidateQueries({ queryKey: volumeKeys.byEnv(toValue(envId)) }),
  })
}

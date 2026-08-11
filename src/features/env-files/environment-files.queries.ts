import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { SaveManagedFileInput } from '@/types/api'
import {
  deleteEnvironmentFile,
  getFileContent,
  getFileTree,
  listEnvironmentFiles,
  saveEnvironmentFile,
} from './environment-files.api'

export const environmentFileKeys = {
  byEnv: (envId: string) => ['environment-files', envId] as const,
  tree: (envId: string) => ['environment-files', envId, 'tree'] as const,
  content: (envId: string, path: string) => ['environment-files', envId, 'content', path] as const,
}

export function useEnvironmentFiles(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => environmentFileKeys.byEnv(toValue(envId))),
    queryFn: () => listEnvironmentFiles(toValue(envId)),
  })
}

export function useSaveEnvironmentFile(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SaveManagedFileInput) => saveEnvironmentFile(toValue(envId), input),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentFileKeys.byEnv(toValue(envId)) }),
  })
}

export function useFileTree(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => environmentFileKeys.tree(toValue(envId))),
    queryFn: () => getFileTree(toValue(envId)),
  })
}

export function useFileContent(
  envId: MaybeRefOrGetter<string>,
  path: MaybeRefOrGetter<string | null>,
) {
  return useQuery({
    queryKey: computed(() => environmentFileKeys.content(toValue(envId), toValue(path) ?? '')),
    queryFn: () => getFileContent(toValue(envId), toValue(path) as string),
    enabled: computed(() => !!toValue(path)),
  })
}

export function useDeleteEnvironmentFile(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (path: string) => deleteEnvironmentFile(toValue(envId), path),
    onSuccess: () => qc.invalidateQueries({ queryKey: environmentFileKeys.byEnv(toValue(envId)) }),
  })
}

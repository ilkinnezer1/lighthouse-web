import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { CreateDatabaseInput, ManagedDatabase } from '@/types/api'
import {
  createDatabase,
  deleteDatabase,
  getDatabase,
  listDatabases,
} from './databases.api'
import { isDatabasePending } from './databases.status'

export const databaseKeys = {
  byEnv: (envId: string) => ['databases', 'env', envId] as const,
  detail: (id: string) => ['databases', id] as const,
}

export function useDatabases(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => databaseKeys.byEnv(toValue(envId))),
    queryFn: () => listDatabases(toValue(envId)),
    // Poll while any database is still provisioning (worker writes back async).
    refetchInterval: (query) =>
      query.state.data?.some((db) => isDatabasePending(db.status)) ? 4000 : false,
  })
}

// All databases across a set of environments — feeds the "attach"/"copy"/
// "create-from-snapshot" source pickers, which span the whole project.
export function useProjectDatabases(envIds: MaybeRefOrGetter<string[]>) {
  return useQueries({
    queries: computed(() =>
      toValue(envIds).map((envId) => ({
        queryKey: databaseKeys.byEnv(envId),
        queryFn: () => listDatabases(envId),
      })),
    ),
    combine: (results) => ({
      databases: results.flatMap((r) => (r.data ?? []) as ManagedDatabase[]),
      isPending: results.some((r) => r.isPending),
    }),
  })
}

export function useDatabase(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => databaseKeys.detail(toValue(id))),
    queryFn: () => getDatabase(toValue(id)),
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status && isDatabasePending(status) ? 4000 : false
    },
  })
}

export function useCreateDatabase(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateDatabaseInput) => createDatabase(toValue(envId), input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: databaseKeys.byEnv(toValue(envId)) }),
  })
}

export function useDeleteDatabase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDatabase(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  })
}

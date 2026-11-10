import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createSnapshot,
  deleteSnapshot,
  importDump,
  listSnapshots,
  resetEnvironment,
  restoreSnapshot,
  updateSnapshot,
} from './snapshots.api'
import { isSnapshotPending } from './databases.status'
import { isImportInFlight } from './snapshots.import'
import { databaseKeys } from './databases.queries'

export const snapshotKeys = {
  byDatabase: (databaseId: string) => ['snapshots', 'db', databaseId] as const,
}

export function useSnapshots(
  databaseId: MaybeRefOrGetter<string>,
  options?: { enabled?: MaybeRefOrGetter<boolean> },
) {
  return useQuery({
    queryKey: computed(() => snapshotKeys.byDatabase(toValue(databaseId))),
    queryFn: () => listSnapshots(toValue(databaseId)),
    enabled: computed(
      () =>
        (options?.enabled === undefined ? true : toValue(options.enabled)) &&
        Boolean(toValue(databaseId)),
    ),
    // Poll while a dump is still being captured or an import is still loading.
    refetchInterval: (query) =>
      query.state.data?.some((s) => isSnapshotPending(s.status) || isImportInFlight(s))
        ? 4000
        : false,
    refetchIntervalInBackground: true,
  })
}

export function useCreateSnapshot(databaseId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => createSnapshot(toValue(databaseId)),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: snapshotKeys.byDatabase(toValue(databaseId)) }),
  })
}

export function useImportDump(databaseId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: {
      file: File
      onProgress?: (loaded: number, total: number) => void
      signal?: AbortSignal
    }) => importDump(toValue(databaseId), vars.file, vars),
    // A rejected or aborted upload can still leave a FAILED row behind.
    onSettled: () =>
      qc.invalidateQueries({ queryKey: snapshotKeys.byDatabase(toValue(databaseId)) }),
  })
}

export function useRestoreSnapshot(databaseId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => restoreSnapshot(id),
    // Restore mutates the live DB; refresh both the snapshot list and the DB row.
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: snapshotKeys.byDatabase(toValue(databaseId)) })
      void qc.invalidateQueries({ queryKey: databaseKeys.detail(toValue(databaseId)) })
    },
  })
}

export function useDeleteSnapshot(databaseId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSnapshot(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: snapshotKeys.byDatabase(toValue(databaseId)) }),
  })
}

export function useUpdateSnapshot(databaseId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; input: { label?: string; isBaseline?: boolean } }) =>
      updateSnapshot(vars.id, vars.input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: snapshotKeys.byDatabase(toValue(databaseId)) }),
  })
}

export function useResetEnvironment(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => resetEnvironment(toValue(envId)),
    // A reset rewrites every database in the environment.
    onSuccess: () => qc.invalidateQueries({ queryKey: ['databases'] }),
  })
}

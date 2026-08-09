import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createVolumeBackup,
  deleteVolumeBackup,
  listVolumeBackups,
  restoreVolumeBackup,
  updateVolumeBackup,
} from './backups.api'
import { volumeKeys } from './volumes.queries'

export const backupKeys = {
  byEnv: (envId: string) => ['volume-backups', envId] as const,
}

export function useVolumeBackups(envId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => backupKeys.byEnv(toValue(envId))),
    queryFn: () => listVolumeBackups(toValue(envId)),
    // A backup is PENDING until the worker finishes tarring and uploading;
    // poll while any is in flight, then stop.
    refetchInterval: (query) =>
      (query.state.data ?? []).some((b) => b.status === 'PENDING') ? 3000 : false,
    // Keep polling while the window is in the background: a backup taken from a
    // panel sitting beside the app under test would otherwise still read
    // "Pending" when you look back at it. Bounded — the interval above stops
    // itself once nothing is in flight.
    refetchIntervalInBackground: true,
  })
}

export function useCreateVolumeBackup(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (volumeName: string) => createVolumeBackup(toValue(envId), volumeName),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.byEnv(toValue(envId)) }),
  })
}

export function useRestoreVolumeBackup(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => restoreVolumeBackup(backupId),
    // A restore rewrites the volume and restarts its containers, so the sizes
    // shown by the volume list are stale the moment it completes.
    onSuccess: () => qc.invalidateQueries({ queryKey: volumeKeys.byEnv(toValue(envId)) }),
  })
}

export function useUpdateVolumeBackup(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: string; input: { label?: string; isBaseline?: boolean } }) =>
      updateVolumeBackup(vars.id, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.byEnv(toValue(envId)) }),
  })
}

export function useDeleteVolumeBackup(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => deleteVolumeBackup(backupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.byEnv(toValue(envId)) }),
  })
}

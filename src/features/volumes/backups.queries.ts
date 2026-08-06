import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createVolumeBackup,
  deleteVolumeBackup,
  listVolumeBackups,
  restoreVolumeBackup,
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

export function useDeleteVolumeBackup(envId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (backupId: string) => deleteVolumeBackup(backupId),
    onSuccess: () => qc.invalidateQueries({ queryKey: backupKeys.byEnv(toValue(envId)) }),
  })
}

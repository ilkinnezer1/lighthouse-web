<script setup lang="ts">
import { computed, ref } from 'vue'
import { Archive, LoaderCircle, RotateCcw, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useCreateVolumeBackup,
  useDeleteVolumeBackup,
  useRestoreVolumeBackup,
  useVolumeBackups,
} from './backups.queries'
import { useVolumes } from './volumes.queries'
import BackupScheduleControl from '@/features/backup-schedules/BackupScheduleControl.vue'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import { formatBytes } from './format'
import { relativeTime } from '@/lib/time'
import type { VolumeBackup, VolumeBackupStatus } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { SignalDot } from '@/components/ui/section'
import type { StatusTone } from '@/features/deployments/deployments.status'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{ envId: string }>()

const { data: backups, isPending, isError } = useVolumeBackups(() => props.envId)
const { data: volumes } = useVolumes(() => props.envId)
const create = useCreateVolumeBackup(() => props.envId)
const restore = useRestoreVolumeBackup(() => props.envId)
const del = useDeleteVolumeBackup(() => props.envId)
const canManage = useCan('env.manage')

// Only volumes that actually exist can be backed up; the API rejects the rest.
const names = computed(() => (volumes.value ?? []).map((v) => v.name))
const selected = ref('')
const target = computed({
  get: () => selected.value || names.value[0] || '',
  set: (v: string) => (selected.value = v),
})

const tone: Record<VolumeBackupStatus, StatusTone> = {
  PENDING: 'active',
  READY: 'success',
  FAILED: 'error',
}

const busy = ref<string | null>(null)

async function onCreate() {
  if (!target.value) return
  try {
    await create.mutateAsync(target.value)
    toast.success(`Backing up "${target.value}"`, {
      description: 'Writers are paused while the archive is taken.',
    })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not start the backup'))
  }
}

async function onRestore(b: VolumeBackup) {
  busy.value = b.id
  try {
    await restore.mutateAsync(b.id)
    toast.success(`Restoring "${b.volumeName}"`, {
      description: 'The app stops briefly while the volume is replaced.',
    })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not restore the backup'))
  } finally {
    busy.value = null
  }
}

async function onDelete(b: VolumeBackup) {
  busy.value = b.id
  try {
    await del.mutateAsync(b.id)
    toast.success('Backup deleted')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not delete the backup'))
  } finally {
    busy.value = null
  }
}
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold tracking-tight text-foreground">
      Volume backups
      <span v-if="backups?.length" class="ml-1 text-muted-foreground/60">{{ backups.length }}</span>
    </h2>
    <p class="mt-1 text-xs text-muted-foreground">
      A snapshot of everything inside a volume, stored in object storage. Writers are paused while
      the archive is taken, so the copy is consistent. Restoring replaces the volume's contents and
      briefly stops whatever is using it.
    </p>

    <div v-if="names.length" class="mt-3 flex flex-wrap items-center gap-2">
      <Select v-model="target">
        <SelectTrigger class="h-8 w-48 text-xs" aria-label="Volume to back up">
          <SelectValue placeholder="Pick a volume" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem v-for="n in names" :key="n" :value="n">{{ n }}</SelectItem>
        </SelectContent>
      </Select>
      <Button
        size="sm"
        :disabled="!canManage || !target || create.isPending.value"
        @click="onCreate"
      >
        <LoaderCircle v-if="create.isPending.value" class="animate-spin" />
        <Archive v-else />
        Back up now
      </Button>
    </div>

    <BackupScheduleControl
      v-if="target"
      :key="target"
      :env-id="props.envId"
      kind="VOLUME"
      :volume-name="target"
    />

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-12 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load backups.</p>

    <p v-else-if="!backups || backups.length === 0" class="mt-3 text-xs text-muted-foreground">
      No backups yet. Nothing in a volume is recoverable until you take one — and tearing down a
      preview environment deletes its volumes.
    </p>

    <div
      v-else
      class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
    >
      <div v-for="b in backups" :key="b.id" class="flex items-center gap-3 bg-card px-4 py-3">
        <SignalDot :tone="tone[b.status]" :title="b.status.toLowerCase()" />

        <div class="min-w-0 flex-1">
          <div class="truncate font-mono text-sm text-foreground">{{ b.volumeName }}</div>
          <div class="truncate text-xs text-muted-foreground">
            {{ relativeTime(b.createdAt) }}
            <template v-if="b.status === 'READY' && b.sizeBytes !== null">
              · {{ formatBytes(b.sizeBytes) }}
            </template>
            <template v-else-if="b.status === 'PENDING'">· archiving…</template>
            <template v-else-if="b.errorSummary">· {{ b.errorSummary }}</template>
          </div>
        </div>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              class="shrink-0 text-muted-foreground"
              :disabled="!canManage || b.status !== 'READY' || busy === b.id"
              title="Restore this backup"
            >
              <LoaderCircle v-if="busy === b.id" class="animate-spin" />
              <RotateCcw v-else />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Restore "{{ b.volumeName }}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything currently in the volume is replaced by this backup, taken
                {{ relativeTime(b.createdAt) }}. Any container using it is stopped for the
                restore and started again afterwards, so the app is briefly down. This cannot be
                undone — take a fresh backup first if the current data still matters.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="onRestore(b)">Restore volume</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              class="shrink-0 text-muted-foreground hover:text-destructive"
              :disabled="!canManage || busy === b.id"
              title="Delete this backup"
            >
              <Trash2 />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this backup?</AlertDialogTitle>
              <AlertDialogDescription>
                The archive is removed from object storage and cannot be recovered.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="onDelete(b)">Delete backup</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  </section>
</template>

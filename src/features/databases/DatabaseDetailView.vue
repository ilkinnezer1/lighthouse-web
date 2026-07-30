<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  Anchor,
  ArrowLeft,
  Camera,
  Copy,
  LoaderCircle,
  RotateCcw,
  Trash2,
  Undo2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDatabase, useDeleteDatabase } from './databases.queries'
import {
  useCreateSnapshot,
  useDeleteSnapshot,
  useRestoreSnapshot,
  useSnapshots,
  useUpdateSnapshot,
} from './snapshots.queries'
import StatusBadge from './StatusBadge.vue'
import { databaseTone, snapshotTone, titleCase } from './databases.status'
import type { DatabaseSnapshot } from '@/types/api'
import { relativeTime } from '@/lib/time'
import { formatBytes } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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

const props = defineProps<{ projectId: string; envId: string; databaseId: string }>()
const router = useRouter()

const { data: db, isPending, isError, error, refetch } = useDatabase(() => props.databaseId)
const deleteDatabase = useDeleteDatabase()

const isPostgres = computed(() => db.value?.type === 'POSTGRES')
const isReady = computed(() => db.value?.status === 'READY')

const {
  data: snapshots,
  isPending: snapshotsPending,
  isError: snapshotsError,
} = useSnapshots(
  () => props.databaseId,
  { enabled: isPostgres },
)
const createSnapshot = useCreateSnapshot(() => props.databaseId)
const restoreSnapshot = useRestoreSnapshot(() => props.databaseId)
const deleteSnapshot = useDeleteSnapshot(() => props.databaseId)
const markBaseline = useUpdateSnapshot(() => props.databaseId)

// Toggling off would leave the environment with no reset point, so the anchor
// only ever promotes — clearing happens by promoting a different snapshot.
async function onSetBaseline(s: DatabaseSnapshot) {
  if (s.isBaseline) {
    toast.info('Already the reset point for this database')
    return
  }
  try {
    await markBaseline.mutateAsync({ id: s.id, input: { isBaseline: true } })
    toast.success('Reset point updated')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not set the reset point'))
  }
}

const connString = computed(() =>
  db.value?.host && db.value.port ? `${db.value.host}:${db.value.port}` : '—',
)
const envHref = computed(() => `/projects/${props.projectId}/env/${props.envId}`)

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

async function onDelete() {
  try {
    await deleteDatabase.mutateAsync(props.databaseId)
    toast.success('Database deleted')
    await router.replace(envHref.value)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not delete database'))
  }
}

async function onCreateSnapshot() {
  try {
    await createSnapshot.mutateAsync()
    toast.success('Snapshot started')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not create snapshot'))
  }
}

async function onRestore(id: string) {
  try {
    await restoreSnapshot.mutateAsync(id)
    toast.success('Restore started')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not restore snapshot'))
  }
}

async function onDeleteSnapshot(id: string) {
  try {
    await deleteSnapshot.mutateAsync(id)
    toast.success('Snapshot deleted')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not delete snapshot'))
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
    <RouterLink
      :to="envHref"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Environment
    </RouterLink>

    <!-- loading -->
    <div v-if="isPending" class="mt-6 space-y-6">
      <Skeleton class="h-8 w-56" />
      <Skeleton class="h-32 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <!-- error -->
    <div
      v-else-if="isError || !db"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(error, 'Database not found.') }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <template v-else>
      <header class="mt-4 flex items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <h1 class="font-mono text-2xl font-semibold tracking-tight text-foreground">
            {{ db.name }}
          </h1>
          <StatusBadge :tone="databaseTone[db.status]" :label="titleCase(db.status)" />
        </div>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" class="text-destructive hover:text-destructive">
              <Trash2 />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {{ db.name }}?</AlertDialogTitle>
              <AlertDialogDescription>
                <template v-if="db.ownsContainer">
                  This tears down the database container and deletes all of its data and
                  snapshots. This cannot be undone.
                </template>
                <template v-else>
                  This detaches the connection from this environment. The underlying database is
                  left untouched.
                </template>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-white hover:bg-destructive/90"
                :disabled="deleteDatabase.isPending.value"
                @click="onDelete"
              >
                <LoaderCircle v-if="deleteDatabase.isPending.value" class="animate-spin" />
                {{ db.ownsContainer ? 'Delete database' : 'Detach database' }}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </header>

      <!-- failure banner -->
      <p
        v-if="db.status === 'FAILED' && db.errorSummary"
        class="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
      >
        {{ db.errorSummary }}
      </p>

      <!-- meta -->
      <dl
        class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3"
      >
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Engine</dt>
          <dd class="mt-1 font-mono text-sm text-foreground">{{ db.type }} {{ db.version }}</dd>
        </div>
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Management</dt>
          <dd class="mt-1 text-sm text-foreground">
            {{ db.ownsContainer ? 'Managed container' : 'Attached connection' }}
          </dd>
        </div>
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Created</dt>
          <dd class="mt-1 text-sm text-foreground">{{ relativeTime(db.createdAt) }}</dd>
        </div>
        <div class="bg-card px-4 py-3 sm:col-span-3">
          <dt class="text-xs text-muted-foreground">Host</dt>
          <dd class="mt-1 flex items-center gap-2">
            <code
              class="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground"
              >{{ connString }}</code
            >
            <Button
              v-if="connString !== '—'"
              variant="ghost"
              size="icon-sm"
              title="Copy host"
              @click="copy(connString, 'Host')"
            >
              <Copy />
            </Button>
          </dd>
          <p class="mt-1 text-xs text-muted-foreground/70">
            Credentials are injected into deployments at runtime; they are never exposed here.
          </p>
        </div>
      </dl>

      <!-- snapshots (Postgres only) -->
      <section v-if="isPostgres" class="mt-8">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-sm font-semibold tracking-tight text-foreground">Snapshots</h2>
          <Button
            size="sm"
            variant="outline"
            :disabled="!isReady || createSnapshot.isPending.value"
            :title="isReady ? undefined : 'Database must be ready'"
            @click="onCreateSnapshot"
          >
            <LoaderCircle v-if="createSnapshot.isPending.value" class="animate-spin" />
            <Camera v-else />
            Take snapshot
          </Button>
        </div>

        <!-- snapshots loading -->
        <div v-if="snapshotsPending" class="mt-3 space-y-2">
          <Skeleton v-for="n in 2" :key="n" class="h-14 w-full rounded-lg" />
        </div>

        <p v-else-if="snapshotsError" class="mt-3 text-sm text-destructive">
          Could not load snapshots.
        </p>

        <!-- snapshots empty -->
        <div
          v-else-if="!snapshots || snapshots.length === 0"
          class="mt-3 rounded-xl border border-dashed border-border py-10 text-center"
        >
          <p class="text-sm text-muted-foreground">
            No snapshots yet. Take one to capture the current data.
          </p>
        </div>

        <!-- snapshots list -->
        <div
          v-else
          class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
        >
          <div
            v-for="s in snapshots"
            :key="s.id"
            class="flex items-center gap-4 bg-card px-4 py-3"
          >
            <StatusBadge :tone="snapshotTone[s.status]" :label="titleCase(s.status)" />
            <div class="min-w-0 flex-1">
              <p class="flex items-center gap-2 text-sm text-foreground">
                <span class="truncate">{{ s.label || relativeTime(s.createdAt) }}</span>
                <span
                  v-if="s.isBaseline"
                  class="shrink-0 rounded-full bg-primary/12 px-2 py-0.5 font-mono text-[10px] font-medium text-primary"
                >
                  baseline
                </span>
              </p>
              <p class="mt-0.5 text-xs text-muted-foreground">
                <template v-if="s.label">{{ relativeTime(s.createdAt) }} · </template>
                {{ s.status === 'READY' ? formatBytes(s.sizeBytes) : s.errorSummary ?? '—' }}
              </p>
            </div>

            <!-- baseline: the state "Reset data" on the environment returns to -->
            <Button
              variant="ghost"
              size="icon-sm"
              :title="s.isBaseline ? 'This is the reset point' : 'Make this the reset point'"
              :aria-pressed="s.isBaseline"
              :disabled="s.status !== 'READY' || markBaseline.isPending.value"
              @click="onSetBaseline(s)"
            >
              <Anchor :class="s.isBaseline ? 'text-primary' : 'opacity-50'" />
            </Button>

            <!-- restore -->
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Restore in place"
                  :disabled="s.status !== 'READY' || !isReady"
                >
                  <Undo2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restore this snapshot?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This overwrites the current contents of
                    <span class="font-mono">{{ db.name }}</span> with the snapshot taken
                    {{ relativeTime(s.createdAt) }}. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="onRestore(s.id)">
                    <Undo2 />
                    Restore
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <!-- delete -->
            <AlertDialog>
              <AlertDialogTrigger as-child>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-destructive hover:text-destructive"
                  title="Delete snapshot"
                >
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this snapshot?</AlertDialogTitle>
                  <AlertDialogDescription>
                    The stored backup is removed from object storage. This cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    class="bg-destructive text-white hover:bg-destructive/90"
                    @click="onDeleteSnapshot(s.id)"
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

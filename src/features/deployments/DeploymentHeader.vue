<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Ban,
  Bell,
  BellOff,
  ExternalLink,
  LoaderCircle,
  Moon,
  RefreshCw,
  Sun,
  TriangleAlert,
  Undo2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useCancelDeployment,
  useRedeployDeployment,
  useRollbackDeployment,
} from './deployments.queries'
import { useDeployWatch } from './useDeployWatch'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import DeployLockedDialog from './DeployLockedDialog.vue'
import { lockConflict } from '@/features/environments/environments.lock'
import {
  SLEEPING_URL_NOTE,
  hibernationErrorMessage,
  isSleeping,
} from '@/features/environments/environments.hibernation'
import {
  useInvalidateLockState,
  useWakeEnvironment,
} from '@/features/environments/environments.queries'
import { useCan } from '@/features/orgs/useCan'
import type { Deployment, EnvironmentLock } from '@/types/api'
import { useProject } from '@/features/projects/projects.queries'
import { durationLabel, relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { shortSha } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Breadcrumb } from '@/components/ui/section'
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

const props = defineProps<{ deployment: Deployment; isActive: boolean; webOffline: boolean }>()
const emit = defineEmits<{ refetch: [] }>()

const router = useRouter()
const cancel = useCancelDeployment()
const redeploy = useRedeployDeployment()
const rollback = useRollbackDeployment()

const projectId = computed(() => props.deployment.environment?.projectId ?? '')
// The deployment payload carries only projectId, so resolve the name for the
// breadcrumb (usually already cached from the project page).
const projectQuery = useProject(projectId)
const projectName = computed(() => projectQuery.data.value?.name ?? 'Project')

const canRedeploy = computed(() => !props.isActive)
const canRollback = computed(() => props.deployment.status === 'SUCCEEDED')
const liveUrl = computed(() => {
  const d = props.deployment
  return d.status === 'RUNNING' || d.status === 'SUCCEEDED' ? d.url : null
})

// The deployment payload does not carry hibernation, but the project it already
// fetched for the breadcrumb does — and without it a sleeping environment shows
// the destructive "Not running" pill, which reads as a build that broke rather
// than an environment someone deliberately put to sleep.
const environment = computed(
  () =>
    projectQuery.data.value?.environments?.find((e) => e.id === props.deployment.environmentId) ??
    null,
)
const sleeping = computed(() => isSleeping(environment.value?.hibernation))

const canManageEnv = useCan('env.manage')
const wake = useWakeEnvironment()

async function onWake() {
  try {
    const { services } = await wake.mutateAsync({
      envId: props.deployment.environmentId,
      projectId: projectId.value || undefined,
    })
    toast.success(`Woken — ${services.length} service${services.length === 1 ? '' : 's'} started`, {
      description: 'The URL answers again once the containers finish booting.',
    })
    emit('refetch')
  } catch (e) {
    toast.error(hibernationErrorMessage(e, 'Could not wake the environment'))
  }
}

// How long the build took — the first thing you look for on a finished deploy.
const buildDuration = computed(() =>
  durationLabel(props.deployment.startedAt, props.deployment.finishedAt),
)

const sourceBranch = computed(
  () => props.deployment.branches?.find((b) => b.role === 'SOURCE') ?? null,
)
const mergeCount = computed(
  () => props.deployment.branches?.filter((b) => b.role === 'MERGE').length ?? 0,
)

const { notifyEnabled, permissionState, toggleNotifications } = useDeployWatch({
  status: () => props.deployment.status,
  label: () => `${projectName.value}/${props.deployment.environment?.name ?? ''}`,
  onFinish: (status) => {
    if (status === 'SUCCEEDED') toast.success('Deployment succeeded')
    else if (status === 'FAILED') toast.error('Deployment failed')
    else toast.info(`Deployment ${status.toLowerCase()}`)
  },
})

async function onCancel() {
  try {
    await cancel.mutateAsync(props.deployment.id)
    toast.success('Cancellation requested')
    emit('refetch')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not cancel'))
  }
}

// Redeploy and rollback both land on a locked environment the same way, so the
// refusal is held once and replayed to whichever one was asked for.
const lockedBy = ref<EnvironmentLock | null>(null)
const refusedAction = ref<'redeploy' | 'rollback' | null>(null)
const invalidateLockState = useInvalidateLockState()

const overridePending = computed(() => redeploy.isPending.value || rollback.isPending.value)
const overrideVerb = computed(() => (refusedAction.value === 'rollback' ? 'Roll back' : 'Redeploy'))

function onLockRefusal(e: unknown, action: 'redeploy' | 'rollback'): boolean {
  const lock = lockConflict(e)
  if (!lock) return false
  lockedBy.value = lock
  refusedAction.value = action
  invalidateLockState(projectId.value || undefined)
  return true
}

async function runRedeploy(overrideLock: boolean) {
  try {
    const created = await redeploy.mutateAsync({ id: props.deployment.id, overrideLock })
    lockedBy.value = null
    toast.success('Redeploy started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    if (onLockRefusal(e, 'redeploy')) return
    toast.error(apiErrorMessage(e, 'Could not redeploy'))
  }
}

async function runRollback(overrideLock: boolean) {
  try {
    const created = await rollback.mutateAsync({ id: props.deployment.id, overrideLock })
    lockedBy.value = null
    toast.success('Rollback started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    if (onLockRefusal(e, 'rollback')) return
    toast.error(apiErrorMessage(e, 'Could not roll back'))
  }
}

function onRedeploy() {
  void runRedeploy(false)
}

function onRollback() {
  void runRollback(false)
}

function onOverride() {
  if (refusedAction.value === 'rollback') void runRollback(true)
  else void runRedeploy(true)
}
</script>

<template>
  <Breadcrumb
    :items="[
      { label: projectName, to: `/projects/${deployment.environment?.projectId}` },
      {
        label: deployment.environment?.name ?? 'environment',
        to: `/projects/${deployment.environment?.projectId}/env/${deployment.environmentId}`,
        mono: true,
      },
      { label: shortSha(deployment.commitSha) ?? 'deployment', mono: true },
    ]"
  />

  <header class="mt-4 flex items-start justify-between gap-4">
    <div class="min-w-0">
      <div class="flex items-center gap-3">
        <DeploymentStatusBadge :status="deployment.status" />
        <span class="font-mono text-sm text-muted-foreground">
          {{ shortSha(deployment.commitSha) ?? '—' }}
        </span>
      </div>
      <p class="mt-2 truncate text-foreground">
        {{ deployment.commitMessage ?? 'No commit message' }}
      </p>
      <p class="mt-1 text-xs text-ink-3">
        {{ deployment.commitAuthor ?? 'unknown' }} · {{ relativeTime(deployment.createdAt) }}
        <template v-if="buildDuration"> · built in {{ buildDuration }}</template>
      </p>
    </div>
    <div class="flex shrink-0 items-center gap-2">
      <a
        v-if="liveUrl && !sleeping && !webOffline"
        :href="liveUrl"
        target="_blank"
        rel="noopener noreferrer"
      >
        <Button variant="outline" size="sm">
          <ExternalLink />
          Open
        </Button>
      </a>
      <!-- Asleep outranks "not running": the containers being down is the
           point, and the URL 404s rather than erroring. -->
      <template v-else-if="liveUrl && sleeping">
        <span
          class="inline-flex items-center gap-1.5 rounded-md border border-rule bg-sunken px-2.5 py-1.5 text-xs font-medium text-ink-2"
          :title="`${SLEEPING_URL_NOTE} — ${liveUrl}`"
        >
          <Moon class="size-3.5" />
          {{ SLEEPING_URL_NOTE }}
        </span>
        <Button
          v-if="canManageEnv"
          variant="outline"
          size="sm"
          :disabled="wake.isPending.value"
          @click="onWake"
        >
          <LoaderCircle v-if="wake.isPending.value" class="animate-spin" />
          <Sun v-else />
          Wake
        </Button>
      </template>
      <span
        v-else-if="liveUrl && webOffline"
        class="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs font-medium text-destructive"
        title="This build finished fine — the container is not running now. Start it below to bring the site back."
      >
        <TriangleAlert class="size-3.5" />
        Not running
      </span>
      <!-- Offered only while it's still running, since that's the only time
           "tell me when it's done" means anything. -->
      <Button
        v-if="isActive && permissionState !== 'unsupported' && permissionState !== 'denied'"
        variant="outline"
        size="sm"
        :aria-pressed="notifyEnabled"
        :title="
          notifyEnabled ? 'You will be notified when this finishes' : 'Notify me when this finishes'
        "
        @click="toggleNotifications"
      >
        <Bell v-if="notifyEnabled" class="text-primary" />
        <BellOff v-else />
        {{ notifyEnabled ? 'Notifying' : 'Notify me' }}
      </Button>
      <Button
        v-if="isActive"
        variant="outline"
        size="sm"
        class="text-destructive hover:text-destructive"
        :disabled="cancel.isPending.value"
        @click="onCancel"
      >
        <Ban />
        Cancel
      </Button>
      <Button
        v-if="canRedeploy"
        variant="outline"
        size="sm"
        :disabled="redeploy.isPending.value"
        @click="onRedeploy"
      >
        <RefreshCw :class="redeploy.isPending.value && 'animate-spin'" />
        Redeploy
      </Button>
      <AlertDialog v-if="canRollback">
        <AlertDialogTrigger as-child>
          <Button variant="outline" size="sm" :disabled="rollback.isPending.value">
            <Undo2 />
            Rollback
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Roll back to this deployment?</AlertDialogTitle>
            <AlertDialogDescription>
              This rebuilds this deployment's exact commit{{ mergeCount ? 's' : '' }} ({{
                shortSha(sourceBranch?.sha ?? deployment.commitSha) ?? 'pinned SHA'
              }}) and makes it live, superseding the current deployment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction :disabled="rollback.isPending.value" @click="onRollback">
              <LoaderCircle v-if="rollback.isPending.value" class="animate-spin" />
              Roll back
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  </header>

  <DeployLockedDialog
    :open="lockedBy !== null"
    :lock="lockedBy"
    :pending="overridePending"
    :action="overrideVerb"
    @update:open="(v: boolean) => !v && (lockedBy = null)"
    @override="onOverride"
  />
</template>

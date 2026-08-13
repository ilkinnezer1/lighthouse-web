<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Ban,
  Bell,
  BellOff,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
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
import type { Deployment } from '@/types/api'
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

async function onRedeploy() {
  try {
    const created = await redeploy.mutateAsync(props.deployment.id)
    toast.success('Redeploy started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not redeploy'))
  }
}

async function onRollback() {
  try {
    const created = await rollback.mutateAsync(props.deployment.id)
    toast.success('Rollback started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not roll back'))
  }
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
      <a v-if="liveUrl && !webOffline" :href="liveUrl" target="_blank" rel="noopener noreferrer">
        <Button variant="outline" size="sm">
          <ExternalLink />
          Open
        </Button>
      </a>
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
</template>

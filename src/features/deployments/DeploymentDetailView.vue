<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import {
  ArrowDown,
  Ban,
  Bell,
  BellOff,
  Check,
  Download,
  ExternalLink,
  GitBranch,
  GitMerge,
  Globe,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCw,
  Search,
  Square,
  SquareTerminal,
  TriangleAlert,
  Undo2,
  Wrench,
  WrapText,
  X,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  deploymentKeys,
  useCancelDeployment,
  useDeployment,
  useDeploymentActions,
  useRedeployDeployment,
  useRollbackDeployment,
  useServiceAction,
} from './deployments.queries'
import type { ServiceAction } from './deployments.api'
import type { DeploymentStageStatus, MaintenanceActionDef } from '@/types/api'
import { useDeploymentLogs } from './useDeploymentLogs'
import { useRuntimeLogs } from './useRuntimeLogs'
import { useDeploymentAction } from './useDeploymentAction'
import { useDeployWatch } from './useDeployWatch'
import AnsiLine from './AnsiLine.vue'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import ServiceHealthBadge from './ServiceHealthBadge.vue'
import ServiceStatsReadout from './ServiceStatsReadout.vue'
import ServiceTerminal from './ServiceTerminal.vue'
import type { HealthTone } from './serviceHealth'
import {
  isTerminalStatus,
  stageTone,
  statusDotClass,
  statusTextClass,
  titleCase,
} from './deployments.status'
import { useProject, useProjectBranches } from '@/features/projects/projects.queries'
import { toBranchMetaMap } from '@/features/projects/branchMeta'
import { durationLabel, relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { shortSha } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Breadcrumb, ErrorState, PageShell } from '@/components/ui/section'
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

const props = defineProps<{ id: string }>()
const qc = useQueryClient()
const router = useRouter()

const { data: deployment, isPending, isError, error, refetch } = useDeployment(() => props.id)
const cancel = useCancelDeployment()
const redeploy = useRedeployDeployment()
const rollback = useRollbackDeployment()
const svcAction = useServiceAction(() => props.id)
const busyService = ref<string | null>(null)

const { logs, connected } = useDeploymentLogs(
  () => props.id,
  () => void qc.invalidateQueries({ queryKey: deploymentKeys.detail(props.id) }),
)

const activeTab = ref<'build' | 'runtime'>('build')
const runtimeAvailable = computed(
  () => deployment.value?.status === 'RUNNING' || deployment.value?.status === 'SUCCEEDED',
)
const runtimeEnabled = computed(() => activeTab.value === 'runtime' && runtimeAvailable.value)

const services = computed(() => deployment.value?.services ?? [])
const selectedService = ref<string | undefined>(undefined)
watch(
  services,
  (svcs) => {
    if (!svcs.length) return
    if (!selectedService.value || !svcs.some((s) => s.name === selectedService.value)) {
      selectedService.value = (svcs.find((s) => s.isWeb) ?? svcs[0]).name
    }
  },
  { immediate: true },
)

const { lines: runtimeLines, streaming: runtimeStreaming } = useRuntimeLogs(() => props.id, {
  enabled: () => runtimeEnabled.value,
  service: () => selectedService.value,
})

const activeLines = computed<Array<{ key: string; line: string; stage: string | null }>>(() =>
  activeTab.value === 'build'
    ? logs.value.map((e) => ({ key: e.id, line: e.line, stage: e.stage }))
    : runtimeLines.value.map((line, i) => ({ key: `r${i}`, line, stage: null })),
)
const activeConnected = computed(() =>
  activeTab.value === 'build' ? connected.value : runtimeStreaming.value,
)

const isActive = computed(() => !!deployment.value && !isTerminalStatus(deployment.value.status))
const canRedeploy = computed(() => !!deployment.value && !isActive.value)

// How long the build took — the first thing you look for on a finished deploy.
const buildDuration = computed(() =>
  durationLabel(deployment.value?.startedAt ?? null, deployment.value?.finishedAt ?? null),
)

/*
 * A stage left PENDING on a deployment that has already finished never ran —
 * it was skipped. Rendering it as "Pending" forever makes a completed deploy
 * look hung, which is the single most confusing thing on this page.
 */
function stageLabel(status: DeploymentStageStatus): string {
  if (status === 'PENDING' && !isActive.value) return 'Skipped'
  return titleCase(status)
}
function stageDisplayTone(status: DeploymentStageStatus) {
  return stageTone[status === 'PENDING' && !isActive.value ? 'SKIPPED' : status]
}
const canRollback = computed(() => deployment.value?.status === 'SUCCEEDED')
const liveUrl = computed(() => {
  const d = deployment.value
  return d && (d.status === 'RUNNING' || d.status === 'SUCCEEDED') ? d.url : null
})
const webService = computed(() => deployment.value?.services?.find((s) => s.isWeb) ?? null)

// Live container tone per service (reported by each row's health badge), so the
// page reflects TRUE state rather than the possibly-stale DB `service.status`.
const liveTone = ref<Record<string, HealthTone>>({})
function onServiceTone(name: string, tone: HealthTone) {
  liveTone.value = { ...liveTone.value, [name]: tone }
}
function serviceDown(svc: { name: string; status: string | null }): boolean {
  const live = liveTone.value[svc.name]
  // Fall back to the DB status only until the live tone has been reported.
  return live ? live === 'down' : svc.status !== 'running'
}

const webOffline = computed(() => !!webService.value && serviceDown(webService.value))

const sourceBranch = computed(
  () => deployment.value?.branches?.find((b) => b.role === 'SOURCE') ?? null,
)
const mergeBranches = computed(
  () => deployment.value?.branches?.filter((b) => b.role === 'MERGE') ?? [],
)
const hasBranchSet = computed(() => !!sourceBranch.value || mergeBranches.value.length > 0)

const projectId = computed(() => deployment.value?.environment?.projectId ?? '')
// The deployment payload carries only projectId, so resolve the name for the
// breadcrumb (usually already cached from the project page).
const projectQuery = useProject(projectId)
const projectName = computed(() => projectQuery.data.value?.name ?? 'Project')
const sourceName = computed(() => sourceBranch.value?.name)
const branchMetaQuery = useProjectBranches(projectId, {
  base: () => sourceName.value,
  enabled: () => hasBranchSet.value && !!projectId.value && !!sourceName.value,
})
const branchMeta = computed(() => toBranchMetaMap(branchMetaQuery.data.value))
const metaFor = (name: string) => branchMeta.value[name] ?? null

const { notifyEnabled, permissionState, toggleNotifications } = useDeployWatch({
  status: () => deployment.value?.status,
  label: () => `${projectName.value}/${deployment.value?.environment?.name ?? ''}`,
  onFinish: (status) => {
    if (status === 'SUCCEEDED') toast.success('Deployment succeeded')
    else if (status === 'FAILED') toast.error('Deployment failed')
    else toast.info(`Deployment ${status.toLowerCase()}`)
  },
})

const logEl = ref<HTMLElement | null>(null)

/*
 * Follow the tail only while the reader is already at the bottom. Scrolling up
 * during a live build used to be impossible — every incoming line yanked you
 * back down, exactly when you were trying to read the error that caused it.
 */
const pinned = ref(true)
const BOTTOM_SLACK = 24

function onLogScroll() {
  const el = logEl.value
  if (!el) return
  pinned.value = el.scrollHeight - el.scrollTop - el.clientHeight <= BOTTOM_SLACK
}

function scrollToLatest() {
  const el = logEl.value
  if (!el) return
  el.scrollTop = el.scrollHeight
  pinned.value = true
}

watch([() => activeLines.value.length, activeTab], async () => {
  await nextTick()
  if (pinned.value) scrollToLatest()
})

// Switching tabs is an explicit "show me this stream", so re-pin.
watch(activeTab, () => {
  pinned.value = true
})

const logFilter = ref('')
const wrapLines = ref(true)

const visibleLines = computed(() => {
  const q = logFilter.value.trim().toLowerCase()
  if (!q) return activeLines.value
  return activeLines.value.filter(
    (e) => e.line.toLowerCase().includes(q) || (e.stage ?? '').toLowerCase().includes(q),
  )
})

const hiddenCount = computed(() => activeLines.value.length - visibleLines.value.length)

function downloadLogs() {
  const name = `${activeTab.value}-${shortSha(deployment.value?.commitSha) ?? props.id}.log`
  const body = activeLines.value
    .map((e) => (e.stage ? `[${e.stage}] ${e.line}` : e.line))
    .join('\n')
  const url = URL.createObjectURL(new Blob([body], { type: 'text/plain' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

async function onCancel() {
  try {
    await cancel.mutateAsync(props.id)
    toast.success('Cancellation requested')
    void refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not cancel'))
  }
}

async function onRedeploy() {
  try {
    const created = await redeploy.mutateAsync(props.id)
    toast.success('Redeploy started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not redeploy'))
  }
}

async function onRollback() {
  try {
    const created = await rollback.mutateAsync(props.id)
    toast.success('Rollback started')
    void router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not roll back'))
  }
}

const actionVerb: Record<ServiceAction, string> = {
  start: 'started',
  stop: 'stopped',
  restart: 'restarted',
}

async function onServiceAction(name: string, action: ServiceAction) {
  busyService.value = name
  try {
    await svcAction.mutateAsync({ name, action })
    toast.success(`${name} ${actionVerb[action]}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, `Could not ${action} ${name}`))
  } finally {
    busyService.value = null
  }
}

const terminalOpen = ref(false)
const terminalService = ref<string | undefined>(undefined)

function onCli(name: string) {
  terminalService.value = name
  terminalOpen.value = true
}

const { data: actionDefs } = useDeploymentActions(() => props.id)
const maintenanceActions = computed(() => actionDefs.value ?? [])

const maint = useDeploymentAction(() => props.id)
const maintStatus = maint.status
const maintLines = maint.lines
const maintExitCode = maint.exitCode
const maintError = maint.errorMessage
const maintAction = maint.activeAction

// The /deployments/:id route reuses this component on a param change, so the
// composable's state would otherwise carry the prior deployment's run.
watch(
  () => props.id,
  () => maint.reset(),
)

function runMaintenance(action: MaintenanceActionDef) {
  void maint.run(action)
}

const maintLogEl = ref<HTMLElement | null>(null)
watch(
  () => maintLines.value.length,
  async () => {
    await nextTick()
    if (maintLogEl.value) maintLogEl.value.scrollTop = maintLogEl.value.scrollHeight
  },
)
</script>

<template>
  <PageShell>
    <!-- loading -->
    <div v-if="isPending" class="space-y-6">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-24 w-full rounded-xl" />
      <Skeleton class="h-96 w-full rounded-xl" />
    </div>

    <!-- error -->
    <ErrorState
      v-else-if="isError || !deployment"
      class="mt-10"
      :message="apiErrorMessage(error, 'Deployment not found.')"
      @retry="() => refetch()"
    />

    <template v-else>
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
            v-if="liveUrl && !webOffline"
            :href="liveUrl"
            target="_blank"
            rel="noopener noreferrer"
          >
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
              notifyEnabled
                ? 'You will be notified when this finishes'
                : 'Notify me when this finishes'
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
                  This rebuilds this deployment's exact commit{{
                    mergeBranches.length ? 's' : ''
                  }}
                  ({{ shortSha(sourceBranch?.sha ?? deployment.commitSha) ?? 'pinned SHA' }}) and
                  makes it live, superseding the current deployment.
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

      <!-- error summary -->
      <p
        v-if="deployment.errorSummary"
        class="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ deployment.errorSummary }}
      </p>

      <section v-if="hasBranchSet" class="mt-6">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Branches</h2>
        <div class="mt-3 overflow-hidden rounded-xl border border-border">
          <div
            v-if="sourceBranch"
            class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
          >
            <GitBranch class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
              {{ sourceBranch.name }}
            </span>
            <span
              v-if="metaFor(sourceBranch.name)?.lastCommitDate"
              class="hidden text-xs text-muted-foreground sm:inline"
            >
              {{ relativeTime(metaFor(sourceBranch.name)!.lastCommitDate!) }}
            </span>
            <span class="font-mono text-xs text-muted-foreground">
              {{ shortSha(sourceBranch.sha) ?? '—' }}
            </span>
            <span class="text-xs text-primary">source</span>
          </div>
          <div
            v-for="b in mergeBranches"
            :key="b.id"
            class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
          >
            <GitMerge class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
              {{ b.name }}
            </span>
            <span
              v-if="(metaFor(b.name)?.aheadBy ?? 0) > 0"
              class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {{ metaFor(b.name)?.aheadBy }} ahead
            </span>
            <span
              v-else-if="metaFor(b.name)?.aheadBy === 0"
              class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
            >
              actual
            </span>
            <span
              v-if="metaFor(b.name)?.lastCommitDate"
              class="hidden text-xs text-muted-foreground sm:inline"
            >
              {{ relativeTime(metaFor(b.name)!.lastCommitDate!) }}
            </span>
            <span class="font-mono text-xs text-muted-foreground">{{
              shortSha(b.sha) ?? '—'
            }}</span>
            <span class="text-xs text-muted-foreground">merged</span>
          </div>
        </div>
      </section>

      <!-- stages -->
      <section v-if="deployment.stages?.length" class="mt-6">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Stages</h2>
        <ol class="mt-3 overflow-hidden rounded-xl border border-border">
          <li
            v-for="stage in deployment.stages"
            :key="stage.id"
            class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
            :class="stageLabel(stage.status) === 'Skipped' && 'opacity-55'"
          >
            <span
              class="size-2 rounded-full"
              :class="statusDotClass[stageDisplayTone(stage.status)]"
            />
            <span class="flex-1 font-mono text-sm text-foreground">{{ stage.name }}</span>
            <span class="font-mono text-xs text-ink-4">
              {{ durationLabel(stage.startedAt, stage.finishedAt) }}
            </span>
            <span
              class="w-20 text-right text-xs font-medium"
              :class="statusTextClass[stageDisplayTone(stage.status)]"
            >
              {{ stageLabel(stage.status) }}
            </span>
          </li>
        </ol>
      </section>

      <!-- services -->
      <section v-if="deployment.services?.length" class="mt-6">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Services</h2>
        <div class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          <div
            v-for="svc in deployment.services"
            :key="svc.id"
            class="flex items-center justify-between gap-3 px-4 py-2.5"
            :class="
              svc.isWeb && serviceDown(svc)
                ? 'bg-destructive/5'
                : svc.isWeb
                  ? 'bg-primary/[0.04]'
                  : 'bg-card'
            "
          >
            <div class="flex min-w-0 items-center gap-2">
              <ServiceHealthBadge
                :deployment-id="props.id"
                :service="svc.name"
                :is-web="svc.isWeb"
                :db-status="svc.status"
                :has-container="!!svc.containerId"
                :port="svc.port"
                @tone="(t) => onServiceTone(svc.name, t)"
              >
                {{ svc.name }}
                <template #after-name>
                  <Badge v-if="svc.isWeb" variant="default" class="shrink-0 gap-1">
                    <Globe class="size-3" />
                    web
                  </Badge>
                </template>
              </ServiceHealthBadge>
              <ServiceStatsReadout
                v-if="svc.status === 'running'"
                :deployment-id="props.id"
                :service="svc.name"
                :enabled="svc.status === 'running'"
              />
            </div>
            <div class="flex shrink-0 items-center gap-0.5">
              <template v-if="svc.status === 'running'">
                <AlertDialog v-if="svc.isWeb">
                  <AlertDialogTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      title="Stop (takes the site offline)"
                      class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                      :disabled="busyService === svc.name"
                    >
                      <Square />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Stop the web service?</AlertDialogTitle>
                      <AlertDialogDescription>
                        “{{ svc.name }}” serves this deployment — stopping it takes the site offline
                        until you start it again.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        class="bg-destructive text-white hover:bg-destructive/90"
                        :disabled="busyService === svc.name"
                        @click="onServiceAction(svc.name, 'stop')"
                      >
                        <LoaderCircle v-if="busyService === svc.name" class="animate-spin" />
                        Take offline
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button
                  v-else
                  variant="ghost"
                  size="icon-sm"
                  title="Stop"
                  class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                  :disabled="busyService === svc.name"
                  @click="onServiceAction(svc.name, 'stop')"
                >
                  <Square />
                </Button>
              </template>
              <Button
                v-else
                variant="ghost"
                size="icon-sm"
                :title="svc.isWeb ? 'Start (brings the site back)' : 'Start'"
                class="text-success hover:bg-success/10 hover:text-success"
                :disabled="busyService === svc.name"
                @click="onServiceAction(svc.name, 'start')"
              >
                <Play />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Restart"
                class="text-primary hover:bg-primary/10 hover:text-primary"
                :disabled="busyService === svc.name"
                @click="onServiceAction(svc.name, 'restart')"
              >
                <RotateCw :class="busyService === svc.name && 'animate-spin'" />
              </Button>
              <Button
                v-if="svc.status === 'running'"
                variant="ghost"
                size="icon-sm"
                title="Open terminal"
                class="text-muted-foreground hover:bg-primary/10 hover:text-primary"
                @click="onCli(svc.name)"
              >
                <SquareTerminal />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <!-- maintenance -->
      <section v-if="maintenanceActions.length" class="mt-6">
        <h2 class="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
          <Wrench class="size-3.5 text-muted-foreground" />
          Maintenance
        </h2>
        <div class="mt-3 flex flex-wrap gap-2">
          <template v-for="action in maintenanceActions" :key="action.id">
            <AlertDialog v-if="action.destructive">
              <AlertDialogTrigger as-child>
                <Button variant="outline" size="sm" :disabled="maintStatus === 'running'">
                  <Play />
                  {{ action.label }}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Run “{{ action.label }}”?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This runs against the live
                    <span class="font-mono">{{ action.service }}</span> container and may change
                    application or database state.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction @click="runMaintenance(action)">Run</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button
              v-else
              variant="outline"
              size="sm"
              :disabled="maintStatus === 'running'"
              @click="runMaintenance(action)"
            >
              <Play />
              {{ action.label }}
            </Button>
          </template>
        </div>

        <div
          v-if="maintStatus !== 'idle'"
          class="mt-3 overflow-hidden rounded-xl border border-border"
        >
          <div
            class="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5"
          >
            <div class="flex min-w-0 items-center gap-2">
              <LoaderCircle
                v-if="maintStatus === 'running'"
                class="size-4 shrink-0 animate-spin text-primary"
              />
              <Check v-else-if="maintStatus === 'succeeded'" class="size-4 shrink-0 text-success" />
              <X v-else class="size-4 shrink-0 text-destructive" />
              <span class="truncate text-sm font-medium text-foreground">
                {{ maintAction?.label }}
              </span>
              <span class="shrink-0 font-mono text-xs text-muted-foreground">
                {{ maintAction?.service }}
              </span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              <span
                v-if="maintStatus !== 'running'"
                class="text-xs font-medium"
                :class="maintStatus === 'succeeded' ? 'text-success' : 'text-destructive'"
              >
                {{ maintExitCode != null ? `exit ${maintExitCode}` : 'failed' }}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                title="Clear"
                @click="maint.reset()"
              >
                <X />
              </Button>
            </div>
          </div>
          <div
            ref="maintLogEl"
            class="log-pane h-64 overflow-auto p-4 font-mono text-xs leading-relaxed"
          >
            <p v-if="maintError" class="text-destructive">{{ maintError }}</p>
            <p v-else-if="maintLines.length === 0 && maintStatus === 'running'" class="log-dim">
              Running…
            </p>
            <div
              v-for="(line, i) in maintLines"
              :key="i"
              class="whitespace-pre-wrap wrap-break-word"
            >
              <AnsiLine :text="line" />
            </div>
          </div>
        </div>
      </section>

      <!-- logs -->
      <section class="mt-6">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-4">
            <button
              type="button"
              class="text-sm font-semibold tracking-tight transition-colors"
              :class="
                activeTab === 'build'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              @click="activeTab = 'build'"
            >
              Build logs
            </button>
            <button
              type="button"
              :disabled="!runtimeAvailable"
              class="text-sm font-semibold tracking-tight transition-colors disabled:cursor-not-allowed disabled:opacity-40"
              :class="
                activeTab === 'runtime'
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :title="runtimeAvailable ? undefined : 'Available while the deployment is running'"
              @click="activeTab = 'runtime'"
            >
              Runtime logs
            </button>
          </div>
          <div class="flex items-center gap-2">
            <div class="relative">
              <Search
                class="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-ink-4"
                aria-hidden="true"
              />
              <input
                v-model="logFilter"
                type="text"
                aria-label="Filter log lines"
                placeholder="Filter…"
                class="h-7 w-36 rounded-md border border-rule bg-transparent pl-7 pr-2 font-mono text-xs text-ink-1 outline-none placeholder:text-ink-4 focus:border-ink-4"
              />
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              :title="wrapLines ? 'Disable line wrapping' : 'Enable line wrapping'"
              :aria-label="wrapLines ? 'Disable line wrapping' : 'Enable line wrapping'"
              :aria-pressed="wrapLines"
              @click="wrapLines = !wrapLines"
            >
              <WrapText :class="!wrapLines && 'opacity-40'" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Download logs"
              aria-label="Download logs"
              :disabled="activeLines.length === 0"
              @click="downloadLogs"
            >
              <Download />
            </Button>
            <span class="inline-flex items-center gap-1.5 text-xs text-ink-3">
              <span
                class="size-1.5 rounded-full"
                :class="activeConnected ? 'bg-signal-live' : 'bg-signal-idle'"
              />
              {{ activeConnected ? 'live' : 'offline' }}
            </span>
          </div>
        </div>
        <div
          v-if="activeTab === 'runtime' && services.length > 1"
          class="mt-3 flex gap-1 overflow-x-auto"
        >
          <button
            v-for="svc in services"
            :key="svc.id"
            type="button"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 font-mono text-xs transition-colors"
            :class="
              selectedService === svc.name
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            "
            @click="selectedService = svc.name"
          >
            <span
              class="size-1.5 rounded-full"
              :class="serviceDown(svc) ? 'bg-muted-foreground/40' : 'bg-success'"
            />
            {{ svc.name }}
            <span v-if="svc.isWeb" class="text-[10px] opacity-70">web</span>
          </button>
        </div>
        <div class="relative mt-3">
          <div
            ref="logEl"
            class="log-pane h-96 overflow-auto rounded-lg p-4 font-mono text-xs leading-relaxed"
            @scroll.passive="onLogScroll"
          >
            <p v-if="activeLines.length === 0" class="log-dim">
              <template v-if="activeTab === 'runtime'">
                {{
                  runtimeAvailable
                    ? 'Waiting for output…'
                    : 'Runtime logs are available while the deployment is running.'
                }}
              </template>
              <template v-else>
                {{ isActive ? 'Waiting for logs…' : 'No logs for this deployment.' }}
              </template>
            </p>

            <p v-else-if="visibleLines.length === 0" class="log-dim">
              No line matches “{{ logFilter }}”.
            </p>

            <div
              v-for="entry in visibleLines"
              :key="entry.key"
              :class="wrapLines ? 'whitespace-pre-wrap wrap-break-word' : 'whitespace-pre'"
            >
              <span v-if="entry.stage" class="log-dim mr-2">[{{ entry.stage }}]</span
              ><AnsiLine :text="entry.line" />
            </div>
          </div>

          <!-- Only offered when the reader has scrolled away from the tail. -->
          <button
            v-if="!pinned && activeLines.length > 0"
            type="button"
            class="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground shadow-lg transition hover:brightness-105"
            @click="scrollToLatest"
          >
            <ArrowDown class="size-3.5" aria-hidden="true" />
            Jump to latest
          </button>
        </div>

        <p v-if="hiddenCount > 0" class="mt-2 text-xs text-ink-4">
          {{ hiddenCount }} line{{ hiddenCount === 1 ? '' : 's' }} hidden by the filter.
        </p>
      </section>
    </template>

    <ServiceTerminal
      v-model:open="terminalOpen"
      :deployment-id="props.id"
      :service="terminalService"
    />
  </PageShell>
</template>

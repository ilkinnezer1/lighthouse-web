<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import {
  ArrowLeft,
  Ban,
  ExternalLink,
  GitBranch,
  GitMerge,
  Globe,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Square,
  SquareTerminal,
  TriangleAlert,
  Undo2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  deploymentKeys,
  useCancelDeployment,
  useDeployment,
  useRedeployDeployment,
  useRollbackDeployment,
  useServiceAction,
} from './deployments.queries'
import type { ServiceAction } from './deployments.api'
import { useDeploymentLogs } from './useDeploymentLogs'
import { useRuntimeLogs } from './useRuntimeLogs'
import AnsiLine from './AnsiLine.vue'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import ServiceTerminal from './ServiceTerminal.vue'
import {
  isTerminalStatus,
  stageTone,
  statusDotClass,
  statusTextClass,
  titleCase,
} from './deployments.status'
import { useProjectBranches } from '@/features/projects/projects.queries'
import { toBranchMetaMap } from '@/features/projects/branchMeta'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { shortSha } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
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
  () => qc.invalidateQueries({ queryKey: deploymentKeys.detail(props.id) }),
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

const isActive = computed(
  () => !!deployment.value && !isTerminalStatus(deployment.value.status),
)
const canRedeploy = computed(() => !!deployment.value && !isActive.value)
const canRollback = computed(() => deployment.value?.status === 'SUCCEEDED')
const liveUrl = computed(() => {
  const d = deployment.value
  return d && (d.status === 'RUNNING' || d.status === 'SUCCEEDED') ? d.url : null
})
const webService = computed(() => deployment.value?.services?.find((s) => s.isWeb) ?? null)
const webOffline = computed(() => !!webService.value && webService.value.status !== 'running')

const sourceBranch = computed(
  () => deployment.value?.branches?.find((b) => b.role === 'SOURCE') ?? null,
)
const mergeBranches = computed(
  () => deployment.value?.branches?.filter((b) => b.role === 'MERGE') ?? [],
)
const hasBranchSet = computed(() => !!sourceBranch.value || mergeBranches.value.length > 0)

const projectId = computed(() => deployment.value?.environment?.projectId ?? '')
const sourceName = computed(() => sourceBranch.value?.name)
const branchMetaQuery = useProjectBranches(projectId, {
  base: () => sourceName.value,
  enabled: () => hasBranchSet.value && !!projectId.value && !!sourceName.value,
})
const branchMeta = computed(() => toBranchMetaMap(branchMetaQuery.data.value))
const metaFor = (name: string) => branchMeta.value[name] ?? null

const logEl = ref<HTMLElement | null>(null)
watch(
  [() => activeLines.value.length, activeTab],
  async () => {
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  },
)

async function onCancel() {
  try {
    await cancel.mutateAsync(props.id)
    toast.success('Cancellation requested')
    refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not cancel'))
  }
}

async function onRedeploy() {
  try {
    const created = await redeploy.mutateAsync(props.id)
    toast.success('Redeploy started')
    router.push({ name: 'deployment', params: { id: created.id } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not redeploy'))
  }
}

async function onRollback() {
  try {
    const created = await rollback.mutateAsync(props.id)
    toast.success('Rollback started')
    router.push({ name: 'deployment', params: { id: created.id } })
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
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
    <!-- loading -->
    <div v-if="isPending" class="space-y-6">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-24 w-full rounded-xl" />
      <Skeleton class="h-96 w-full rounded-xl" />
    </div>

    <!-- error -->
    <div
      v-else-if="isError || !deployment"
      class="mt-10 flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(error, 'Deployment not found.') }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <template v-else>
      <RouterLink
        :to="`/projects/${deployment.environment?.projectId}/env/${deployment.environmentId}`"
        class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft class="size-4" />
        {{ deployment.environment?.name ?? 'Environment' }}
      </RouterLink>

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
          <p class="mt-1 text-xs text-muted-foreground">
            {{ deployment.commitAuthor ?? 'unknown' }} · {{ relativeTime(deployment.createdAt) }}
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
            title="The web service is stopped — start it to bring the site back"
          >
            <TriangleAlert class="size-3.5" />
            Site offline
          </span>
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
            <span class="font-mono text-xs text-muted-foreground">{{ shortSha(b.sha) ?? '—' }}</span>
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
          >
            <span class="size-2 rounded-full" :class="statusDotClass[stageTone[stage.status]]" />
            <span class="flex-1 font-mono text-sm text-foreground">{{ stage.name }}</span>
            <span class="text-xs font-medium" :class="statusTextClass[stageTone[stage.status]]">
              {{ titleCase(stage.status) }}
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
              svc.isWeb && svc.status !== 'running'
                ? 'bg-destructive/5'
                : svc.isWeb
                  ? 'bg-primary/[0.04]'
                  : 'bg-card'
            "
          >
            <div class="flex min-w-0 items-center gap-2">
              <span
                class="size-1.5 shrink-0 rounded-full"
                :class="
                  svc.status === 'running'
                    ? 'bg-success'
                    : svc.isWeb
                      ? 'bg-destructive animate-pulse'
                      : 'bg-muted-foreground/40'
                "
              />
              <span class="truncate font-mono text-sm text-foreground">{{ svc.name }}</span>
              <Badge v-if="svc.isWeb" variant="default" class="shrink-0 gap-1">
                <Globe class="size-3" />
                web
              </Badge>
              <span
                v-if="svc.isWeb && svc.status !== 'running'"
                class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-destructive"
              >
                <TriangleAlert class="size-3" />
                Site offline
              </span>
              <span v-else class="shrink-0 text-xs text-muted-foreground">
                {{ svc.status ?? '—' }}<span v-if="svc.port"> · :{{ svc.port }}</span>
              </span>
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
                        “{{ svc.name }}” serves this deployment — stopping it takes the site
                        offline until you start it again.
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
          <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class="size-1.5 rounded-full"
              :class="activeConnected ? 'bg-success' : 'bg-muted-foreground/40'"
            />
            {{ activeConnected ? 'live' : 'offline' }}
          </span>
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
              :class="svc.status === 'running' ? 'bg-success' : 'bg-muted-foreground/40'"
            />
            {{ svc.name }}
            <span v-if="svc.isWeb" class="text-[10px] opacity-70">web</span>
          </button>
        </div>
        <div
          ref="logEl"
          class="mt-3 h-96 overflow-auto rounded-xl border border-border p-4 font-mono text-xs leading-relaxed"
          style="background: #0a0d14"
        >
          <p v-if="activeLines.length === 0" class="text-muted-foreground">
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
          <div
            v-for="entry in activeLines"
            :key="entry.key"
            class="whitespace-pre-wrap wrap-break-word text-foreground/90"
          >
            <span v-if="entry.stage" class="mr-2 text-muted-foreground/60">[{{ entry.stage }}]</span><AnsiLine :text="entry.line" />
          </div>
        </div>
      </section>
    </template>

    <ServiceTerminal
      v-model:open="terminalOpen"
      :deployment-id="props.id"
      :service="terminalService"
    />
  </div>
</template>

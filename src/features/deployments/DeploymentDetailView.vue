<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { ArrowLeft, Ban, ExternalLink, RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { deploymentKeys, useCancelDeployment, useDeployment } from './deployments.queries'
import { useDeploymentLogs } from './useDeploymentLogs'
import AnsiLine from './AnsiLine.vue'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import { type StatusTone, isTerminalStatus, stageTone, titleCase } from './deployments.status'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ id: string }>()
const qc = useQueryClient()

const { data: deployment, isPending, isError, error, refetch } = useDeployment(() => props.id)
const cancel = useCancelDeployment()

const { logs, connected } = useDeploymentLogs(
  () => props.id,
  () => qc.invalidateQueries({ queryKey: deploymentKeys.detail(props.id) }),
)

const isActive = computed(
  () => !!deployment.value && !isTerminalStatus(deployment.value.status),
)
const liveUrl = computed(() => {
  const d = deployment.value
  return d && (d.status === 'RUNNING' || d.status === 'SUCCEEDED') ? d.url : null
})

const dotClass: Record<StatusTone, string> = {
  queued: 'bg-muted-foreground/40',
  active: 'bg-primary animate-pulse',
  success: 'bg-success',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground/40',
}

const logEl = ref<HTMLElement | null>(null)
watch(
  () => logs.value.length,
  async () => {
    await nextTick()
    if (logEl.value) logEl.value.scrollTop = logEl.value.scrollHeight
  },
)

const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : '—')

async function onCancel() {
  try {
    await cancel.mutateAsync(props.id)
    toast.success('Cancellation requested')
    refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not cancel'))
  }
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
              {{ shortSha(deployment.commitSha) }}
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
          <a v-if="liveUrl" :href="liveUrl" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              <ExternalLink />
              Open
            </Button>
          </a>
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
        </div>
      </header>

      <!-- error summary -->
      <p
        v-if="deployment.errorSummary"
        class="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ deployment.errorSummary }}
      </p>

      <!-- stages -->
      <section v-if="deployment.stages?.length" class="mt-6">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Stages</h2>
        <ol class="mt-3 overflow-hidden rounded-xl border border-border">
          <li
            v-for="stage in deployment.stages"
            :key="stage.id"
            class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
          >
            <span class="size-2 rounded-full" :class="dotClass[stageTone[stage.status]]" />
            <span class="flex-1 font-mono text-sm text-foreground">{{ stage.name }}</span>
            <span class="text-xs text-muted-foreground">{{ titleCase(stage.status) }}</span>
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
            class="flex items-center justify-between gap-3 bg-card px-4 py-2.5"
          >
            <span class="font-mono text-sm text-foreground">
              {{ svc.name }}
              <span v-if="svc.isWeb" class="ml-2 text-xs text-primary">web</span>
            </span>
            <span class="text-xs text-muted-foreground">
              {{ svc.status ?? '—' }}<span v-if="svc.port"> · :{{ svc.port }}</span>
            </span>
          </div>
        </div>
      </section>

      <!-- logs -->
      <section class="mt-6">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold tracking-tight text-foreground">Build logs</h2>
          <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              class="size-1.5 rounded-full"
              :class="connected ? 'bg-success' : 'bg-muted-foreground/40'"
            />
            {{ connected ? 'live' : 'offline' }}
          </span>
        </div>
        <div
          ref="logEl"
          class="mt-3 h-96 overflow-auto rounded-xl border border-border p-4 font-mono text-xs leading-relaxed"
          style="background: #0a0d14"
        >
          <p v-if="logs.length === 0" class="text-muted-foreground">
            {{ isActive ? 'Waiting for logs…' : 'No logs for this deployment.' }}
          </p>
          <div
            v-for="entry in logs"
            :key="entry.id"
            class="whitespace-pre-wrap wrap-break-word text-foreground/90"
          >
            <span v-if="entry.stage" class="mr-2 text-muted-foreground/60">[{{ entry.stage }}]</span><AnsiLine :text="entry.line" />
          </div>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useQueryClient } from '@tanstack/vue-query'
import { ArrowDown, Download, Search, WrapText } from '@lucide/vue'
import { deploymentKeys } from './deployments.queries'
import { useDeploymentLogs } from './useDeploymentLogs'
import { useRuntimeLogs } from './useRuntimeLogs'
import { isServiceDown, type ServiceTones } from './serviceTones'
import AnsiLine from './AnsiLine.vue'
import type { Deployment, Service } from '@/types/api'
import { shortSha } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  deploymentId: string
  deployment: Deployment
  isActive: boolean
  tones: ServiceTones
}>()

const qc = useQueryClient()

const { logs, connected } = useDeploymentLogs(
  () => props.deploymentId,
  () => void qc.invalidateQueries({ queryKey: deploymentKeys.detail(props.deploymentId) }),
)

const activeTab = ref<'build' | 'runtime'>('build')
const runtimeAvailable = computed(
  () => props.deployment.status === 'RUNNING' || props.deployment.status === 'SUCCEEDED',
)
const runtimeEnabled = computed(() => activeTab.value === 'runtime' && runtimeAvailable.value)

const services = computed(() => props.deployment.services ?? [])
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

const { lines: runtimeLines, streaming: runtimeStreaming } = useRuntimeLogs(
  () => props.deploymentId,
  {
    enabled: () => runtimeEnabled.value,
    service: () => selectedService.value,
  },
)

const activeLines = computed<Array<{ key: string; line: string; stage: string | null }>>(() =>
  activeTab.value === 'build'
    ? logs.value.map((e) => ({ key: e.id, line: e.line, stage: e.stage }))
    : runtimeLines.value.map((line, i) => ({ key: `r${i}`, line, stage: null })),
)
const activeConnected = computed(() =>
  activeTab.value === 'build' ? connected.value : runtimeStreaming.value,
)

const serviceDown = (svc: Service) => isServiceDown(props.tones, svc)

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
  const name = `${activeTab.value}-${shortSha(props.deployment.commitSha) ?? props.deploymentId}.log`
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
</script>

<template>
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

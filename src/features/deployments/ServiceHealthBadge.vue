<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import { useServiceHealth } from './deployments.queries'
import {
  type HealthTone,
  healthDotClass,
  healthLabel,
  healthTextClass,
  healthTone,
} from './serviceHealth'

const props = defineProps<{
  deploymentId: string
  service: string
  isWeb: boolean
  // DB-recorded status — the fallback shown until live health arrives.
  dbStatus: string | null
  // Whether a container exists to inspect (drives the live query).
  hasContainer: boolean
  port: number | null
}>()

// Lets the parent row reconcile its background/affordances against live truth
// instead of the stale DB status (e.g. show "Site offline" for a dead web svc).
const emit = defineEmits<{ tone: [HealthTone] }>()

const { data } = useServiceHealth(
  () => props.deploymentId,
  () => props.service,
  { enabled: () => props.hasContainer },
)

const resolved = computed(() => {
  const h = data.value
  if (h) {
    const tone = healthTone(h)
    return {
      tone,
      dotClass: healthDotClass[tone],
      textClass: healthTextClass[tone],
      label: healthLabel(h),
      restarts: h.restartCount > 0 ? h.restartCount : null,
    }
  }
  // No live data yet: trust the DB status as a best-effort placeholder.
  const running = props.dbStatus === 'running'
  const tone: HealthTone = running ? 'ok' : 'down'
  return {
    tone,
    dotClass: running
      ? 'bg-success'
      : props.isWeb
        ? 'bg-destructive animate-pulse'
        : 'bg-muted-foreground/40',
    textClass: 'text-muted-foreground',
    label: props.dbStatus ?? '—',
    restarts: null,
  }
})

watchEffect(() => emit('tone', resolved.value.tone))

const webOffline = computed(() => props.isWeb && resolved.value.tone === 'down')
</script>

<template>
  <span class="size-1.5 shrink-0 rounded-full" :class="resolved.dotClass" />
  <span class="truncate font-mono text-sm text-foreground"><slot /></span>
  <slot name="after-name" />
  <span
    v-if="webOffline"
    class="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-destructive"
    title="The container is stopped — start it to bring the site back"
  >
    <TriangleAlert class="size-3" />
    Not running
  </span>
  <span
    v-else
    class="inline-flex shrink-0 items-center gap-1 font-mono text-xs font-medium"
    :class="resolved.textClass"
  >
    <TriangleAlert v-if="resolved.tone !== 'ok'" class="size-3" />
    {{ resolved.label
    }}<span v-if="resolved.restarts != null" class="opacity-80"> · restarts: {{ resolved.restarts }}</span
    ><span v-if="port" class="text-muted-foreground"> · :{{ port }}</span>
  </span>
</template>

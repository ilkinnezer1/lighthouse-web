<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { formatBytes } from '@/lib/utils'
import { Sparkline } from '@/components/ui/sparkline'
import { useServiceStats } from './deployments.queries'

const props = defineProps<{
  deploymentId: string
  service: string
  enabled: boolean
}>()

const { data } = useServiceStats(
  () => props.deploymentId,
  () => props.service,
  { enabled: () => props.enabled },
)

// Client-side trend history. The component unmounts when a service stops, so
// these reset naturally — no manual teardown needed.
const HISTORY = 20
const cpuHistory = ref<number[]>([])
const memHistory = ref<number[]>([])

function push(buf: number[], n: number) {
  buf.push(n)
  if (buf.length > HISTORY) buf.shift()
  return buf
}

watch(data, (s) => {
  if (!s) return
  cpuHistory.value = push([...cpuHistory.value], s.cpuPct)
  memHistory.value = push([...memHistory.value], s.memUsedBytes)
})

const readout = computed(() => {
  const s = data.value
  if (!s) return null
  return {
    cpu: `${s.cpuPct.toFixed(1)}%`,
    // Each side gets its own unit so a tiny "used" stays legible against a huge limit.
    mem: `${formatBytes(s.memUsedBytes)} / ${formatBytes(s.memLimitBytes)}`,
    // Cumulative network counters since container start, rendered as totals.
    netRx: formatBytes(s.netRxBytes),
    netTx: formatBytes(s.netTxBytes),
    // Disk I/O collapsed to a single read+write total to stay compact.
    disk: formatBytes(s.blkReadBytes + s.blkWriteBytes),
  }
})
</script>

<template>
  <span v-if="readout" class="shrink-0 font-mono text-xs text-muted-foreground">
    <span class="inline-flex items-center gap-1">
      <span>{{ readout.cpu }}</span>
      <Sparkline :values="cpuHistory" class="text-primary/80" />
    </span>
    ·
    <span class="inline-flex items-center gap-1">
      <span>{{ readout.mem }}</span>
      <Sparkline :values="memHistory" class="text-primary/80" />
    </span>
    ·
    <span class="text-muted-foreground/70" title="network in / out"
      >↓{{ readout.netRx }} ↑{{ readout.netTx }}</span
    >
    ·
    <span class="text-muted-foreground/70" title="disk read + write">⇅ {{ readout.disk }}</span>
  </span>
</template>

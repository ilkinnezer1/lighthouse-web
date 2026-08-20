<script setup lang="ts">
import { computed } from 'vue'
import { useFinding } from './findings.queries'
import AnsiLine from '@/features/deployments/AnsiLine.vue'
import type { LogSnapshotStatus } from '@/types/api'

const props = defineProps<{ findingId: string; status: LogSnapshotStatus }>()

// The text is not on the list payloads, so it is fetched only once someone
// opens the finding — and never at all when there was nothing to capture.
const query = useFinding(() => props.findingId, {
  enabled: () => props.status === 'CAPTURED',
})

const lines = computed(() => {
  const text = query.data.value?.logSnapshot
  return text ? text.replace(/\n+$/, '').split('\n') : []
})
const truncated = computed(() => query.data.value?.logSnapshotTruncated ?? false)
</script>

<template>
  <div>
    <h4 class="text-xs font-medium text-ink-2">Logs at the time</h4>

    <!--
      "Not captured" and "captured nothing" are different facts. Collapsing them
      would let a missing snapshot read as proof the app was silent.
    -->
    <p v-if="status === 'UNAVAILABLE'" class="mt-1 text-xs text-ink-4">
      Not captured — the container was already gone, or the worker could not be reached.
    </p>

    <p v-else-if="query.isPending.value" class="mt-1 text-xs text-ink-4">Loading the snapshot…</p>

    <p v-else-if="query.isError.value" class="mt-1 text-xs text-ink-4">
      Could not load the captured logs.
    </p>

    <p v-else-if="lines.length === 0" class="mt-1 text-xs text-ink-4">
      Captured — this container had written nothing.
    </p>

    <!-- The capture is size-capped, so a full pane is not proof of a whole
         story — the top of the output may be missing. -->
    <p v-else-if="truncated" class="mt-1 text-xs text-ink-4">
      The tail of what the container had written — earlier output was trimmed.
    </p>

    <div
      v-if="status === 'CAPTURED' && lines.length"
      class="log-pane mt-2 max-h-64 overflow-auto rounded-lg p-3 font-mono text-xs leading-relaxed"
    >
      <div v-for="(line, i) in lines" :key="i" class="whitespace-pre-wrap wrap-break-word">
        <AnsiLine :text="line" />
      </div>
    </div>
  </div>
</template>

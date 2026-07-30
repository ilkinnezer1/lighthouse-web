<script setup lang="ts">
import { computed } from 'vue'
import type { StatusTone } from '@/features/deployments/deployments.status'

const props = withDefaults(
  defineProps<{
    tone: StatusTone
    size?: 'sm' | 'md'
  }>(),
  { size: 'md' },
)

// A dot you read, not a badge that shouts — the signal colours are already
// desaturated in the token layer, so no ring or glow is needed here.
const toneClass: Record<StatusTone, string> = {
  queued: 'bg-signal-idle',
  active: 'bg-signal-progress animate-pulse',
  success: 'bg-signal-live',
  error: 'bg-signal-error',
  neutral: 'bg-signal-idle',
}

const cls = computed(() => [
  props.size === 'sm' ? 'size-1.5' : 'size-2',
  toneClass[props.tone],
])
</script>

<template>
  <span class="shrink-0 rounded-full" :class="cls" />
</template>

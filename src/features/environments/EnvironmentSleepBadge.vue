<script setup lang="ts">
import { computed } from 'vue'
import { Moon } from '@lucide/vue'
import {
  sleepBadgeCompactLabel,
  sleepBadgeLabel,
  sleepBadgeTitle,
} from './environments.hibernation'
import { useNowMs } from '@/lib/clock'
import type { EnvironmentHibernation } from '@/types/api'

// Muted on purpose, next to the amber lock and the red findings flag: an
// environment asleep is resting, not broken. The loud half of the message lives
// where it can be acted on — beside the URL, which is the thing that stops
// working.
const props = defineProps<{ hibernation?: EnvironmentHibernation | null; compact?: boolean }>()

const now = useNowMs()
const label = computed(() =>
  props.compact
    ? sleepBadgeCompactLabel(props.hibernation, now.value)
    : sleepBadgeLabel(props.hibernation, now.value),
)
const title = computed(() => sleepBadgeTitle(props.hibernation, now.value))
</script>

<template>
  <span
    v-if="label"
    class="inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium text-ink-3"
    :title="title"
  >
    <Moon class="size-3" />
    {{ label }}
  </span>
</template>

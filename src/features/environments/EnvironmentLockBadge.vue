<script setup lang="ts">
import { computed } from 'vue'
import { Lock } from '@lucide/vue'
import { lockHolderName, lockRemainingLabel, lockState } from './environments.lock'
import { useNowMs } from '@/lib/clock'
import { clockTime } from '@/lib/time'
import type { EnvironmentLock } from '@/types/api'

const props = defineProps<{
  lock: EnvironmentLock | null
  currentUserId?: string | null
}>()

const now = useNowMs()
const state = computed(() => lockState(props.lock, props.currentUserId, now.value))

const label = computed(() => {
  if (state.value.kind === 'unlocked') return ''
  const who = state.value.kind === 'mine' ? 'You' : lockHolderName(state.value.lock.lockedBy)
  return `${who} · ${lockRemainingLabel(state.value.remainingMs)} left`
})

const title = computed(() => {
  if (state.value.kind === 'unlocked') return ''
  const { lock } = state.value
  const who = lockHolderName(lock.lockedBy)
  const until = `Locked by ${who} until ${clockTime(lock.expiresAt)}`
  return lock.reason ? `${until} — ${lock.reason}` : until
})
</script>

<template>
  <span
    v-if="state.kind !== 'unlocked'"
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
      state.kind === 'mine'
        ? 'bg-primary/10 text-primary'
        : 'bg-signal-progress/10 text-signal-progress',
    ]"
    :title="title"
  >
    <Lock class="size-3" />
    {{ label }}
  </span>
</template>

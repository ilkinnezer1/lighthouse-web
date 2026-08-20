<script setup lang="ts">
import { Flag } from '@lucide/vue'

// The board's third answer: what is deployed where, who is on it, and whether
// anything is wrong with it. A bare glyph and a tally, not a pill — the lock
// badge is the claim on the row and this must not compete with it.
defineProps<{ count?: number | null }>()
</script>

<template>
  <span
    v-if="count"
    class="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap text-signal-error"
    :title="`${count} open finding${count === 1 ? '' : 's'} on this environment`"
  >
    <Flag class="size-3" />
    {{ count }} open
  </span>
</template>

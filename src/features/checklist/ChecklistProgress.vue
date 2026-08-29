<script setup lang="ts">
import { computed } from 'vue'
import { ListChecks } from '@lucide/vue'
import { boardLabel, boardTitle, isComplete } from './checklist.progress'

// The board's fourth answer, after what is on it, who is on it and whether
// anything is wrong with it: whether anyone has tested it yet. A glyph and a
// number, matching the findings flag beside it — neither may out-shout the lock.
const props = defineProps<{ progress?: { total: number; remaining: number } | null }>()

const label = computed(() => boardLabel(props.progress))
const done = computed(() => !!props.progress && isComplete(props.progress))
</script>

<template>
  <span
    v-if="label"
    class="inline-flex items-center gap-1 text-xs font-medium whitespace-nowrap"
    :class="done ? 'text-ink-4' : 'text-signal-progress'"
    :title="boardTitle(progress) ?? undefined"
  >
    <ListChecks class="size-3" />
    {{ label }}
  </span>
</template>

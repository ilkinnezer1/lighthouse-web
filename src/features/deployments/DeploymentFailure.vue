<script setup lang="ts">
import { computed } from 'vue'
import { Ban, GitMerge, ServerCrash, TriangleAlert } from '@lucide/vue'
import { failureReason } from './failureReason'

const props = defineProps<{ summary?: string | null }>()

const reason = computed(() => failureReason(props.summary))

const icon = computed(() => {
  switch (reason.value?.kind) {
    case 'merge-conflict':
      return GitMerge
    case 'cancelled':
      return Ban
    case 'builder-missing':
      return ServerCrash
    default:
      return TriangleAlert
  }
})

// A cancellation is an outcome, not a fault — it should not read as an alarm.
const neutral = computed(() => reason.value?.kind === 'cancelled')
</script>

<template>
  <div
    v-if="reason"
    class="mt-5 rounded-lg border px-4 py-3"
    :class="neutral ? 'border-border bg-muted/40' : 'border-destructive/30 bg-destructive/10'"
  >
    <div class="flex gap-3">
      <component
        :is="icon"
        class="mt-0.5 size-4 shrink-0"
        :class="neutral ? 'text-muted-foreground' : 'text-destructive'"
      />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium" :class="neutral ? 'text-foreground' : 'text-destructive'">
          {{ reason.title }}
        </p>

        <p v-if="reason.hint" class="mt-1 text-sm text-muted-foreground">
          {{ reason.hint }}
        </p>

        <ul v-if="reason.files?.length" class="mt-2 flex flex-wrap gap-1.5">
          <li
            v-for="file in reason.files"
            :key="file"
            class="rounded bg-destructive/10 px-1.5 py-0.5 font-mono text-xs text-destructive"
          >
            {{ file }}
          </li>
        </ul>

        <!-- The recorded line, kept verbatim: the headline is an interpretation
             of it, and a reader chasing an unclassified failure needs the
             original most of all. Dropped only when it would repeat the title. -->
        <p
          v-if="reason.detail !== reason.title"
          class="mt-2 break-words font-mono text-xs text-muted-foreground/80"
        >
          {{ reason.detail }}
        </p>
      </div>
    </div>
  </div>
</template>

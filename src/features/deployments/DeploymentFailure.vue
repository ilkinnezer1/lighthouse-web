<script setup lang="ts">
import { computed } from 'vue'
import { Ban, ChevronRight, FileWarning, GitMerge, ServerCrash, TriangleAlert } from '@lucide/vue'
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
    case 'compose-include':
    case 'compose-env-file':
      return FileWarning
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

        <pre
          v-if="reason.lastLog"
          class="mt-2 overflow-x-auto rounded-md bg-sunken px-2.5 py-1.5 font-mono text-xs whitespace-pre-wrap break-words text-foreground/90"
          >{{ reason.lastLog }}</pre>

        <!-- The headline is an interpretation; the recorded line stays one click
             away for anyone chasing a failure it does not explain. -->
        <details v-if="reason.detail !== reason.title" class="group mt-2">
          <summary
            class="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground transition-colors marker:content-none hover:text-foreground"
          >
            <ChevronRight class="size-3 transition-transform group-open:rotate-90" />
            Details
          </summary>
          <p class="mt-1.5 break-words font-mono text-xs text-muted-foreground/80">
            {{ reason.detail }}
          </p>
        </details>
      </div>
    </div>
  </div>
</template>

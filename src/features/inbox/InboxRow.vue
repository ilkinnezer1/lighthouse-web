<script setup lang="ts">
import { computed } from 'vue'
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleSlash,
  CircleX,
  Database,
  Flag,
  FlagOff,
  Lock,
  LockOpen,
} from '@lucide/vue'
import { notificationTone, type InboxTone } from './inbox.format'

const props = defineProps<{
  kind: string
  headline: string
  detail?: string | null
  meta: string
  unread: boolean
  count?: number
  expandable?: boolean
  expanded?: boolean
  nested?: boolean
}>()

// Severity is carried by colour, subject by the glyph — three identical dots
// would make a dense tray unscannable.
const ICONS: Record<string, typeof CircleCheck> = {
  'deploy.succeeded': CircleCheck,
  'deploy.failed': CircleX,
  'deploy.cancelled': CircleSlash,
  'deploy.skipped_locked': Lock,
  'lock.overridden': LockOpen,
  'database.provision_failed': Database,
  'database.snapshot_failed': Database,
  'finding.created': Flag,
  'finding.resolved': FlagOff,
}

const TONE_CLASS: Record<InboxTone, string> = {
  ok: 'text-signal-live',
  warn: 'text-signal-progress',
  error: 'text-signal-error',
}

const icon = computed(() => ICONS[props.kind] ?? CircleAlert)
const toneClass = computed(() => TONE_CLASS[notificationTone(props.kind)])
</script>

<template>
  <!--
    Unread is a left marker plus a tone step, the same grammar the sidebar uses
    for "you are here" — a filled pill would be the loudest thing on the page.
  -->
  <div
    class="relative flex w-full items-start gap-2.5 py-2.5 pr-3 text-left transition-colors before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:transition-colors"
    :class="[
      nested ? 'pl-9' : 'pl-3',
      unread ? 'bg-primary/[0.04] before:bg-primary' : 'before:bg-transparent',
    ]"
  >
    <component :is="icon" class="mt-0.5 size-4 shrink-0" :class="toneClass" aria-hidden="true" />

    <div class="min-w-0 flex-1">
      <p class="text-sm leading-snug" :class="unread ? 'text-ink-1' : 'text-ink-2'">
        {{ headline }}
      </p>
      <p v-if="detail" class="mt-0.5 truncate text-xs text-ink-3">{{ detail }}</p>
      <p v-if="meta" class="mt-0.5 truncate font-mono text-[0.6875rem] text-ink-4">{{ meta }}</p>
    </div>

    <span
      v-if="count && count > 1"
      class="mt-0.5 shrink-0 rounded-full border border-rule px-1.5 font-mono text-[0.625rem] leading-4 text-ink-3"
    >
      {{ count }}
    </span>

    <ChevronDown
      v-if="expandable"
      class="mt-0.5 size-3.5 shrink-0 text-ink-4 transition-transform"
      :class="expanded && 'rotate-180'"
      aria-hidden="true"
    />
  </div>
</template>

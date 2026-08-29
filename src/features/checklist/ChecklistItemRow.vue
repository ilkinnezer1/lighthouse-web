<script setup lang="ts">
import { computed } from 'vue'
import { Check, History, LoaderCircle, RotateCcw, Trash2, X } from '@lucide/vue'
import { checkFreshness, itemState } from './checklist.staleness'
import { checkedLine, itemDotClass, itemStateLabel, itemTextClass } from './checklist.format'
import { personName } from '@/features/findings/findings.format'
import { shortAgo } from '@/lib/time'
import { shortSha } from '@/lib/utils'
import type { ChecklistItem, DeploymentRef } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{
  item: ChecklistItem
  // The build being viewed. Every tick on this row is measured against it.
  build: DeploymentRef
  canCheck?: boolean
  busy?: boolean
}>()

defineEmits<{ pass: []; fail: []; undo: []; remove: [] }>()

const state = computed(() => itemState(props.item))
const check = computed(() => ('check' in state.value ? state.value.check : null))

const line = computed(() =>
  check.value ? checkedLine(check.value, shortAgo(check.value.createdAt)) : null,
)

const added = computed(() => {
  const { item } = props
  if (check.value || item.source !== 'MANUAL' || !item.createdBy) return null
  return `Added by ${personName(item.createdBy)} · ${shortAgo(item.createdAt)}`
})

const freshness = computed(() =>
  state.value.kind === 'stale' ? checkFreshness(state.value.check, props.build) : null,
)
const checkedSha = computed(() =>
  freshness.value && 'checkedSha' in freshness.value ? shortSha(freshness.value.checkedSha) : null,
)
const currentSha = computed(() =>
  freshness.value?.kind === 'superseded' ? shortSha(freshness.value.currentSha) : null,
)
</script>

<template>
  <div class="group flex items-start gap-3 py-3">
    <span
      class="mt-1.5 size-2 shrink-0 rounded-full"
      :class="itemDotClass[state.kind]"
      :title="itemStateLabel[state.kind]"
    />

    <div class="min-w-0 flex-1">
      <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <span class="text-sm text-ink-1">{{ item.title }}</span>

        <a
          v-if="item.issueKey && item.issueUrl"
          :href="item.issueUrl"
          target="_blank"
          rel="noreferrer"
          class="font-mono text-[0.6875rem] text-ink-4 transition-colors hover:text-primary"
        >
          {{ item.issueKey }}
        </a>
        <span v-else-if="item.issueKey" class="font-mono text-[0.6875rem] text-ink-4">
          {{ item.issueKey }}
        </span>
      </div>

      <!-- Who ticked it, on every row and visible to everyone: two people
           testing the same ticket unaware of each other is the waste this
           whole section exists to remove. -->
      <p v-if="line" class="mt-0.5 truncate text-xs text-ink-4">{{ line }}</p>
      <p v-else-if="added" class="mt-0.5 truncate text-xs text-ink-4">{{ added }}</p>

      <p v-if="check?.note" class="mt-1 text-xs text-ink-3">{{ check.note }}</p>

      <!--
        Said out loud rather than implied: a tick shown next to a build it was
        not made on reads as being about that build, which is untrue.
      -->
      <p
        v-if="freshness && freshness.kind !== 'this-build'"
        class="mt-1 flex items-start gap-1.5 text-xs text-ink-3"
      >
        <History class="mt-0.5 size-3 shrink-0 text-ink-4" aria-hidden="true" />
        <span>
          <template v-if="checkedSha">
            Checked on <span class="font-mono text-ink-2">{{ checkedSha }}</span>
          </template>
          <template v-else>Checked on an earlier build</template>

          <template v-if="freshness.kind === 'rebuilt'">
            — this build is a redeploy of the same commit
          </template>
          <template v-else-if="currentSha">
            — this build is <span class="font-mono text-ink-2">{{ currentSha }}</span>
          </template>
          <!-- The leading space is load-bearing: Vue condenses a newline-only
               text node away, and "abc1234— this" is what is left without it. -->
          <template v-else> — this is a later build</template>
        </span>
      </p>
    </div>

    <div v-if="canCheck" class="flex shrink-0 items-center gap-0.5">
      <LoaderCircle v-if="busy" class="mr-1 size-3.5 animate-spin text-ink-4" aria-hidden="true" />

      <Button
        variant="ghost"
        size="sm"
        class="px-2"
        :class="state.kind === 'passed' && 'text-signal-live'"
        :disabled="busy"
        :aria-pressed="state.kind === 'passed'"
        title="Passed on this build"
        @click="$emit('pass')"
      >
        <Check />
        <span class="sr-only sm:not-sr-only">Pass</span>
      </Button>

      <Button
        variant="ghost"
        size="sm"
        class="px-2"
        :class="state.kind === 'failed' && 'text-signal-error'"
        :disabled="busy"
        :aria-pressed="state.kind === 'failed'"
        title="Failed on this build"
        @click="$emit('fail')"
      >
        <X />
        <span class="sr-only sm:not-sr-only">Fail</span>
      </Button>

      <Button
        v-if="item.check"
        variant="ghost"
        size="icon-sm"
        class="text-ink-4"
        :disabled="busy"
        title="Undo this check"
        @click="$emit('undo')"
      >
        <RotateCcw />
      </Button>

      <!-- Retiring the chore, not the tick: the item belongs to the
           environment, so this takes it off every build's list. -->
      <AlertDialog>
        <AlertDialogTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-ink-4 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
            :disabled="busy"
            title="Remove this item"
          >
            <Trash2 />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{{ item.title }}"?</AlertDialogTitle>
            <AlertDialogDescription>
              The item belongs to the environment, so this takes it off every build's list along
              with every pass and fail recorded against it. Seeded items come back the next time
              their ticket is in a build's changes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction @click="$emit('remove')">Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>

    <span
      v-else
      class="hidden shrink-0 text-xs font-medium sm:block"
      :class="itemTextClass[state.kind]"
    >
      {{ itemStateLabel[state.kind] }}
    </span>
  </div>
</template>

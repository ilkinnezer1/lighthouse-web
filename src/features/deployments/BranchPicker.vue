<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Search } from '@lucide/vue'
import type { BranchIssue, BranchMeta, RepoBranch } from '@/types/api'
import { issueLabel } from './issueLabel'
import { relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'

const props = defineProps<{
  branches: (RepoBranch & Partial<BranchIssue>)[]
  exclude?: string
  loading?: boolean
  error?: string | null
  meta?: Record<string, BranchMeta>
}>()

const selected = defineModel<string[]>({ required: true })

const search = ref('')

const visible = computed(() => {
  const q = search.value.trim().toLowerCase()
  return props.branches
    .filter((b) => b.name !== props.exclude)
    .filter((b) => {
      if (!q) return true
      // Searching by ticket number has to work now that a row can read as one.
      const label = issueLabel(b)
      return b.name.toLowerCase().includes(q) || !!label?.toLowerCase().includes(q)
    })
})

function toggle(name: string) {
  const next = new Set(selected.value)
  if (next.has(name)) next.delete(name)
  else next.add(name)
  selected.value = [...next]
}

const isSelected = (name: string) => selected.value.includes(name)
const metaFor = (name: string) => props.meta?.[name] ?? null
</script>

<template>
  <div class="rounded-lg border border-border">
    <div class="flex items-center gap-2 border-b border-border px-3 py-2">
      <Search class="size-4 shrink-0 text-muted-foreground" />
      <input
        v-model="search"
        type="text"
        placeholder="Search branches…"
        class="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>

    <!-- pr-3 clears the 8px overlay scrollbar, which otherwise sits on the sha. -->
    <div class="max-h-56 overflow-auto p-1 pr-3">
      <p v-if="loading" class="px-2 py-6 text-center text-sm text-muted-foreground">
        Loading branches…
      </p>
      <p v-else-if="error" class="px-2 py-6 text-center text-sm text-destructive">
        {{ error }}
      </p>
      <p
        v-else-if="visible.length === 0"
        class="px-2 py-6 text-center text-sm text-muted-foreground"
      >
        {{ search ? 'No matching branches.' : 'No other branches to merge.' }}
      </p>
      <button
        v-for="b in visible"
        v-else
        :key="b.name"
        type="button"
        class="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent/50"
        @click="toggle(b.name)"
      >
        <span
          class="flex size-4 shrink-0 items-center justify-center rounded border transition-colors"
          :class="
            isSelected(b.name)
              ? 'border-primary bg-primary text-primary-foreground'
              : 'border-muted-foreground/40'
          "
        >
          <Check v-if="isSelected(b.name)" class="size-3" />
        </span>
        <span class="min-w-0 flex-1">
          <template v-if="issueLabel(b)">
            <span class="block truncate text-sm text-foreground">{{ issueLabel(b) }}</span>
            <span class="block truncate font-mono text-xs text-muted-foreground">{{ b.name }}</span>
          </template>
          <span v-else class="block truncate font-mono text-sm text-foreground">{{ b.name }}</span>
        </span>
        <template v-if="metaFor(b.name)">
          <span
            v-if="(metaFor(b.name)?.aheadBy ?? 0) > 0"
            class="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          >
            {{ metaFor(b.name)?.aheadBy }} ahead
          </span>
          <span
            v-else-if="metaFor(b.name)?.aheadBy === 0"
            class="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
          >
            actual
          </span>
          <span
            v-if="metaFor(b.name)?.lastCommitDate"
            class="hidden shrink-0 text-xs text-muted-foreground sm:inline"
          >
            {{ relativeTime(metaFor(b.name)!.lastCommitDate!) }}
          </span>
        </template>
        <span class="shrink-0 font-mono text-xs text-muted-foreground">{{ shortSha(b.sha) }}</span>
      </button>
    </div>

    <div
      v-if="selected.length"
      class="border-t border-border px-3 py-1.5 text-xs text-muted-foreground"
    >
      {{ selected.length }} branch{{ selected.length === 1 ? '' : 'es' }} to merge
    </div>
  </div>
</template>

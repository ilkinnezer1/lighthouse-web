<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { GitBranch, GitMerge } from '@lucide/vue'
import { statusTone, titleCase } from './deployments.status'
import { clockTime, relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'
import { SignalDot } from '@/components/ui/section'
import type { DeploymentBranch, DeploymentStatus } from '@/types/api'

const props = defineProps<{
  to: string
  status: DeploymentStatus
  commitSha?: string | null
  commitMessage?: string | null
  createdAt: string
  branches?: DeploymentBranch[]
  project?: string | null
  env?: string | null
  time?: 'clock' | 'relative'
}>()

const source = computed(() => props.branches?.find((b) => b.role === 'SOURCE') ?? null)
const mergeCount = computed(() => props.branches?.filter((b) => b.role === 'MERGE').length ?? 0)
const timeLabel = computed(() =>
  props.time === 'relative' ? relativeTime(props.createdAt) : clockTime(props.createdAt),
)
</script>

<template>
  <RouterLink
    :to="to"
    :title="titleCase(status)"
    class="group flex items-baseline gap-3 py-3 transition-colors hover:bg-accent/40"
  >
    <SignalDot :tone="statusTone[status]" class="translate-y-[-1px]" />

    <span v-if="project" class="flex shrink-0 items-baseline gap-1">
      <span class="truncate text-sm text-ink-1">{{ project }}</span>
      <span v-if="env" class="font-mono text-xs text-ink-4">/{{ env }}</span>
    </span>

    <span v-if="commitSha" class="shrink-0 font-mono text-xs text-ink-4">
      {{ shortSha(commitSha) }}
    </span>

    <span class="min-w-0 flex-1 truncate text-sm text-ink-2">
      {{ commitMessage ?? 'No commit message' }}
    </span>

    <span
      v-if="source"
      class="hidden shrink-0 items-center gap-1 font-mono text-xs text-ink-4 md:inline-flex"
    >
      <GitBranch class="size-3.5" />
      {{ source.name }}
    </span>
    <span
      v-if="mergeCount > 0"
      class="hidden shrink-0 items-center gap-0.5 font-mono text-[0.6875rem] text-ink-4 md:inline-flex"
    >
      <GitMerge class="size-3" />
      {{ mergeCount }}
    </span>

    <span class="shrink-0 font-mono text-xs text-ink-4">{{ timeLabel }}</span>
  </RouterLink>
</template>

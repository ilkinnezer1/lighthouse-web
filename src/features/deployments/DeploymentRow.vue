<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { GitBranch, GitMerge } from '@lucide/vue'
import { statusDotClass, statusTone, titleCase } from './deployments.status'
import { clockTime, relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'
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
    class="group flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/40"
  >
    <span class="size-2.5 shrink-0 rounded-full" :class="statusDotClass[statusTone[status]]" />

    <span v-if="project" class="flex shrink-0 items-baseline gap-1">
      <span class="truncate text-sm font-medium text-foreground">{{ project }}</span>
      <span v-if="env" class="font-mono text-xs text-muted-foreground/70">/{{ env }}</span>
    </span>

    <span v-if="commitSha" class="shrink-0 font-mono text-xs text-muted-foreground/70">
      {{ shortSha(commitSha) }}
    </span>

    <span class="min-w-0 flex-1 truncate text-sm text-foreground/90">
      {{ commitMessage ?? 'No commit message' }}
    </span>

    <span
      v-if="source"
      class="hidden shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground/80 md:inline-flex"
    >
      <GitBranch class="size-3.5" />
      {{ source.name }}
    </span>
    <span
      v-if="mergeCount > 0"
      class="hidden shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-flex"
    >
      <GitMerge class="size-3" />
      {{ mergeCount }}
    </span>

    <span class="shrink-0 text-xs text-muted-foreground/60">{{ timeLabel }}</span>
  </RouterLink>
</template>

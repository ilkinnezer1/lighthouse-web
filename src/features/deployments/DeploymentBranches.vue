<script setup lang="ts">
import { computed } from 'vue'
import { GitBranch, GitMerge } from '@lucide/vue'
import type { DeploymentBranch } from '@/types/api'
import { useProjectBranches } from '@/features/projects/projects.queries'
import { toBranchMetaMap } from '@/features/projects/branchMeta'
import { relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'

const props = defineProps<{ branches: DeploymentBranch[]; projectId: string }>()

const sourceBranch = computed(() => props.branches.find((b) => b.role === 'SOURCE') ?? null)
const mergeBranches = computed(() => props.branches.filter((b) => b.role === 'MERGE'))
const hasBranchSet = computed(() => !!sourceBranch.value || mergeBranches.value.length > 0)

const sourceName = computed(() => sourceBranch.value?.name)
const branchMetaQuery = useProjectBranches(() => props.projectId, {
  base: () => sourceName.value,
  enabled: () => hasBranchSet.value && !!props.projectId && !!sourceName.value,
})
const branchMeta = computed(() => toBranchMetaMap(branchMetaQuery.data.value))
const metaFor = (name: string) => branchMeta.value[name] ?? null
</script>

<template>
  <section v-if="hasBranchSet" class="mt-6">
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Branches</h2>
    <div class="mt-3 overflow-hidden rounded-xl border border-border">
      <div
        v-if="sourceBranch"
        class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
      >
        <GitBranch class="size-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
          {{ sourceBranch.name }}
        </span>
        <span
          v-if="metaFor(sourceBranch.name)?.lastCommitDate"
          class="hidden text-xs text-muted-foreground sm:inline"
        >
          {{ relativeTime(metaFor(sourceBranch.name)!.lastCommitDate!) }}
        </span>
        <span class="font-mono text-xs text-muted-foreground">
          {{ shortSha(sourceBranch.sha) ?? '—' }}
        </span>
        <span class="text-xs text-primary">source</span>
      </div>
      <div
        v-for="b in mergeBranches"
        :key="b.id"
        class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
      >
        <GitMerge class="size-4 shrink-0 text-muted-foreground" />
        <span class="min-w-0 flex-1 truncate font-mono text-sm text-foreground">
          {{ b.name }}
        </span>
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
          class="hidden text-xs text-muted-foreground sm:inline"
        >
          {{ relativeTime(metaFor(b.name)!.lastCommitDate!) }}
        </span>
        <span class="font-mono text-xs text-muted-foreground">{{ shortSha(b.sha) ?? '—' }}</span>
        <span class="text-xs text-muted-foreground">merged</span>
      </div>
    </div>
  </section>
</template>

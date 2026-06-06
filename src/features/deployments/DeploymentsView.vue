<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { GitBranch, GitMerge, Rocket, RotateCcw } from '@lucide/vue'
import { useDeploymentsFeed } from './deployments.queries'
import { type StatusTone, statusTone, titleCase } from './deployments.status'
import { useProjects } from '@/features/projects/projects.queries'
import { clockTime, dayLabel } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { DeploymentListItem, DeploymentStatus } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const router = useRouter()

const statusFilter = ref<DeploymentStatus | 'all'>('all')
const projectFilter = ref<string>('all')

const status = computed(() => (statusFilter.value === 'all' ? undefined : statusFilter.value))
const projectId = computed(() => (projectFilter.value === 'all' ? undefined : projectFilter.value))

const { data: projects } = useProjects()

const feed = useDeploymentsFeed({ status, projectId })
const items = computed(() => feed.data.value?.pages.flatMap((p) => p.items) ?? [])

const groups = computed(() => {
  const out: { label: string; items: DeploymentListItem[] }[] = []
  for (const d of items.value) {
    const label = dayLabel(d.createdAt)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(d)
    else out.push({ label, items: [d] })
  }
  return out
})

const statusOptions: DeploymentStatus[] = [
  'SUCCEEDED',
  'FAILED',
  'RUNNING',
  'BUILDING',
  'QUEUED',
  'CANCELLED',
]

const dotClass: Record<StatusTone, string> = {
  queued: 'bg-muted-foreground/40',
  active: 'bg-primary animate-pulse',
  success: 'bg-success',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground/40',
}

const sourceOf = (d: DeploymentListItem) => d.branches.find((b) => b.role === 'SOURCE') ?? null
const mergeCount = (d: DeploymentListItem) => d.branches.filter((b) => b.role === 'MERGE').length
const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : null)

function goToDeployment(id: string) {
  router.push(`/deployments/${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Deployments</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Every deployment across your projects, newest first.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <Select v-model="projectFilter">
          <SelectTrigger class="h-9 w-44">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem v-for="p in projects ?? []" :key="p.id" :value="p.id">
              {{ p.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="statusFilter">
          <SelectTrigger class="h-9 w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem v-for="s in statusOptions" :key="s" :value="s">
              {{ titleCase(s) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
    </header>

    <div v-if="feed.isPending.value" class="mt-8 overflow-hidden rounded-xl border border-border">
      <div
        v-for="n in 8"
        :key="n"
        class="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
      >
        <Skeleton class="size-2.5 rounded-full" />
        <Skeleton class="h-4 w-40" />
        <Skeleton class="h-3 flex-1" />
        <Skeleton class="h-3 w-12" />
      </div>
    </div>

    <div
      v-else-if="feed.isError.value"
      class="mt-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(feed.error.value) }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => feed.refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <div
      v-else-if="items.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Rocket class="size-6 text-primary" />
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No deployments found</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Try a different filter, or deploy an environment to see it here.
      </p>
    </div>

    <div v-else class="mt-8">
      <section v-for="group in groups" :key="group.label" class="mb-6 last:mb-0">
        <div
          class="sticky top-0 z-10 flex items-center gap-2 bg-background/80 py-1.5 backdrop-blur"
        >
          <h2 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {{ group.label }}
          </h2>
          <span class="text-xs text-muted-foreground/60">{{ group.items.length }}</span>
        </div>

        <div class="overflow-hidden rounded-xl border border-border">
          <button
            v-for="d in group.items"
            :key="d.id"
            type="button"
            :title="titleCase(d.status)"
            class="group flex w-full items-center gap-3 border-b border-border bg-card px-4 py-2.5 text-left transition-colors last:border-b-0 hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
            @click="goToDeployment(d.id)"
          >
            <span class="size-2.5 shrink-0 rounded-full" :class="dotClass[statusTone[d.status]]" />

            <span class="flex shrink-0 items-baseline gap-1">
              <span class="truncate text-sm font-medium text-foreground">
                {{ d.environment.project.name }}
              </span>
              <span class="font-mono text-xs text-muted-foreground/70">
                /{{ d.environment.name }}
              </span>
            </span>

            <span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">
              {{ d.commitMessage ?? 'No commit message' }}
            </span>

            <span
              v-if="sourceOf(d)"
              class="hidden shrink-0 items-center gap-1 font-mono text-xs text-muted-foreground/80 md:inline-flex"
            >
              <GitBranch class="size-3.5" />
              {{ sourceOf(d)?.name }}
            </span>
            <span
              v-if="mergeCount(d) > 0"
              class="hidden shrink-0 items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground md:inline-flex"
            >
              <GitMerge class="size-3" />
              {{ mergeCount(d) }}
            </span>

            <span
              v-if="shortSha(d.commitSha)"
              class="hidden shrink-0 font-mono text-xs text-muted-foreground/70 sm:inline"
            >
              {{ shortSha(d.commitSha) }}
            </span>
            <span class="shrink-0 font-mono text-xs tabular-nums text-muted-foreground/60">
              {{ clockTime(d.createdAt) }}
            </span>
          </button>
        </div>
      </section>

      <div v-if="feed.hasNextPage.value" class="mt-2 flex justify-center">
        <Button
          variant="outline"
          size="sm"
          :disabled="feed.isFetchingNextPage.value"
          @click="() => feed.fetchNextPage()"
        >
          <RotateCcw v-if="feed.isFetchingNextPage.value" class="animate-spin" />
          {{ feed.isFetchingNextPage.value ? 'Loading…' : 'Load more' }}
        </Button>
      </div>
    </div>
  </div>
</template>

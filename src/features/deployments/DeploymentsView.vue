<script setup lang="ts">
import { computed } from 'vue'
import { RotateCcw } from '@lucide/vue'
import { useDeploymentsFeed } from './deployments.queries'
import { titleCase } from './deployments.status'
import DeploymentRow from './DeploymentRow.vue'
import { useProjects } from '@/features/projects/projects.queries'
import { useSelectFilter } from '@/lib/feed'
import { dayLabel } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { DeploymentListItem, DeploymentStatus } from '@/types/api'
import { Button } from '@/components/ui/button'
import { EmptyState, ErrorState, LoadingRows, PageHead, PageShell } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const [statusFilter, status] = useSelectFilter<DeploymentStatus>()
const [projectFilter, projectId] = useSelectFilter<string>()

const { data: projects } = useProjects()

const feed = useDeploymentsFeed({ status, projectId })
const items = feed.items

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
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Deployments"
      deck="Every deployment across your projects, newest first."
    >
      <template #actions>
        <Select v-model="projectFilter">
          <SelectTrigger class="h-8 w-40 text-xs" aria-label="Filter by project">
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
          <SelectTrigger class="h-8 w-36 text-xs" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem v-for="s in statusOptions" :key="s" :value="s">
              {{ titleCase(s) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHead>

    <div class="mt-12">
      <LoadingRows v-if="feed.isPending.value" :rows="10" />

      <ErrorState
        v-else-if="feed.isError.value"
        :message="apiErrorMessage(feed.error.value, 'Could not load deployments.')"
        :retrying="feed.isFetching.value"
        @retry="() => feed.refetch()"
      />

      <EmptyState
        v-else-if="items.length === 0"
        title="No deployments here"
        deck="Try a different filter, or deploy an environment to see it land."
      />

      <div v-else>
        <section v-for="group in groups" :key="group.label" class="mb-10 last:mb-0">
          <div
            class="sticky top-0 z-10 flex items-baseline gap-2.5 border-b border-rule bg-background/90 pb-2 backdrop-blur"
          >
            <h2 class="eyebrow">{{ group.label }}</h2>
            <span class="font-mono text-xs text-ink-4">{{ group.items.length }}</span>
          </div>

          <div class="rule-y">
            <DeploymentRow
              v-for="d in group.items"
              :key="d.id"
              :to="`/deployments/${d.id}`"
              :status="d.status"
              :commit-sha="d.commitSha"
              :commit-message="d.commitMessage"
              :created-at="d.createdAt"
              :branches="d.branches"
              :project="d.environment.project.name"
              :env="d.environment.name"
              time="clock"
            />
          </div>
        </section>

        <div v-if="feed.hasNextPage.value" class="mt-8 flex justify-center">
          <Button
            variant="ghost"
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
  </PageShell>
</template>

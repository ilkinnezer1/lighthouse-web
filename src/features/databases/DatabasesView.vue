<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { RotateCcw } from '@lucide/vue'
import { useDatabasesFeed } from './databases.queries'
import { databaseDisplay, titleCase } from './databases.status'
import StatusBadge from './StatusBadge.vue'
import { useProjects } from '@/features/projects/projects.queries'
import { useSelectFilter } from '@/lib/feed'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { DatabaseListItem, DatabaseStatus, DatabaseType } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
} from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const router = useRouter()

const [statusFilter, status] = useSelectFilter<DatabaseStatus>()
const [typeFilter, type] = useSelectFilter<DatabaseType>()
const [projectFilter, projectId] = useSelectFilter<string>()

const { data: projects } = useProjects()

const feed = useDatabasesFeed({ status, type, projectId })
const items = feed.items

const typeOptions: DatabaseType[] = ['POSTGRES', 'MYSQL', 'REDIS', 'MONGO']
const statusOptions: DatabaseStatus[] = ['READY', 'PROVISIONING', 'FAILED']

const engineLabel: Record<DatabaseType, string> = {
  POSTGRES: 'Postgres',
  MYSQL: 'MySQL',
  REDIS: 'Redis',
  MONGO: 'MongoDB',
}

// An empty result after filtering is a different problem from having no data at
// all, and needs a different way out.
const filtered = computed(
  () => statusFilter.value !== 'all' || typeFilter.value !== 'all' || projectFilter.value !== 'all',
)
function clearFilters() {
  statusFilter.value = 'all'
  typeFilter.value = 'all'
  projectFilter.value = 'all'
}

function hostOf(d: DatabaseListItem) {
  if (d.host && d.port) return `${d.host}:${d.port}`
  return d.status === 'PROVISIONING' ? 'Provisioning…' : '—'
}

function goToDatabase(d: DatabaseListItem) {
  void router.push(`/projects/${d.environment.project.id}/env/${d.environment.id}/databases/${d.id}`)
}
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Databases"
      deck="Every managed database across your projects."
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
        <Select v-model="typeFilter">
          <SelectTrigger class="h-8 w-32 text-xs" aria-label="Filter by engine">
            <SelectValue placeholder="All engines" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All engines</SelectItem>
            <SelectItem v-for="t in typeOptions" :key="t" :value="t">
              {{ engineLabel[t] }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="statusFilter">
          <SelectTrigger class="h-8 w-32 text-xs" aria-label="Filter by status">
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
      <LoadingRows v-if="feed.isPending.value" :rows="6" />

      <ErrorState
        v-else-if="feed.isError.value"
        :message="apiErrorMessage(feed.error.value, 'Could not load databases.')"
        :retrying="feed.isFetching.value"
        @retry="() => feed.refetch()"
      />

      <EmptyState
        v-else-if="items.length === 0 && filtered"
        title="Nothing matches those filters"
        deck="Widen the search to see the databases you do have."
      >
        <template #action>
          <Button variant="outline" size="sm" @click="clearFilters">Clear filters</Button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="items.length === 0"
        title="No managed databases"
        deck="Add one from an environment and it will appear here with its connection details."
      />

      <div v-else>
        <SectionHead eyebrow="All databases" :count="items.length" />
        <div class="rule-y">
          <button
            v-for="d in items"
            :key="d.id"
            type="button"
            class="flex w-full items-center gap-4 py-4 text-left transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:outline-none"
            @click="goToDatabase(d)"
          >
            <StatusBadge :tone="databaseDisplay(d).tone" :label="databaseDisplay(d).label" />

            <span class="min-w-0 shrink-0 basis-56">
              <span class="block truncate font-mono text-sm text-ink-1">{{ d.name }}</span>
              <span class="mt-0.5 block truncate text-xs text-ink-4">
                {{ d.environment.project.name }}/{{ d.environment.name }}
              </span>
            </span>

            <span class="hidden shrink-0 basis-32 text-xs text-ink-3 sm:block">
              {{ engineLabel[d.type] }} {{ d.version }}
            </span>

            <code class="min-w-0 flex-1 truncate font-mono text-xs text-ink-4">
              {{ hostOf(d) }}
            </code>

            <span class="shrink-0 basis-24 text-right text-xs text-ink-4">
              {{ relativeTime(d.createdAt) }}
            </span>
          </button>
        </div>

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

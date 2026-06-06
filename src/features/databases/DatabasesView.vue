<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Database, RotateCcw } from '@lucide/vue'
import { useDatabasesFeed } from './databases.queries'
import { databaseTone, titleCase } from './databases.status'
import StatusBadge from './StatusBadge.vue'
import { useProjects } from '@/features/projects/projects.queries'
import { useSelectFilter } from '@/lib/feed'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { DatabaseListItem, DatabaseStatus, DatabaseType } from '@/types/api'
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
const engineDot: Record<DatabaseType, string> = {
  POSTGRES: 'bg-sky-500',
  MYSQL: 'bg-amber-500',
  REDIS: 'bg-red-500',
  MONGO: 'bg-emerald-500',
}

function hostOf(d: DatabaseListItem) {
  if (d.host && d.port) return `${d.host}:${d.port}`
  return d.status === 'PROVISIONING' ? 'Provisioning…' : '—'
}

function goToDatabase(d: DatabaseListItem) {
  router.push(
    `/projects/${d.environment.project.id}/env/${d.environment.id}/databases/${d.id}`,
  )
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Databases</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Every managed database across your projects.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
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
        <Select v-model="typeFilter">
          <SelectTrigger class="h-9 w-36">
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
          <SelectTrigger class="h-9 w-36">
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

    <div v-if="feed.isPending.value" class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <Skeleton v-for="n in 6" :key="n" class="h-32 rounded-xl" />
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
        <Database class="size-6 text-primary" />
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No databases found</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Add a database to an environment and it will show up here.
      </p>
    </div>

    <div v-else class="mt-8">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <button
          v-for="d in items"
          :key="d.id"
          type="button"
          class="group flex flex-col gap-3 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/30 focus-visible:border-primary focus-visible:outline-none"
          @click="goToDatabase(d)"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="size-2 rounded-full" :class="engineDot[d.type]" />
              {{ engineLabel[d.type] }} {{ d.version }}
            </span>
            <StatusBadge :tone="databaseTone[d.status]" :label="titleCase(d.status)" />
          </div>

          <div class="min-w-0">
            <p class="truncate font-mono text-sm font-medium text-foreground">{{ d.name }}</p>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ d.environment.project.name }}
              <span class="text-muted-foreground/50">/</span>
              {{ d.environment.name }}
            </p>
          </div>

          <div class="mt-auto flex items-center justify-between gap-2 pt-1">
            <code class="truncate font-mono text-xs text-muted-foreground/80">{{ hostOf(d) }}</code>
            <span class="shrink-0 text-xs text-muted-foreground/60">
              {{ relativeTime(d.createdAt) }}
            </span>
          </div>
        </button>
      </div>

      <div v-if="feed.hasNextPage.value" class="mt-6 flex justify-center">
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

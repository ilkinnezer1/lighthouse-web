<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ChevronRight,
  Database,
  GitBranch,
  GitMerge,
  Plus,
  Rocket,
  RotateCcw,
} from '@lucide/vue'
import { useProject } from '@/features/projects/projects.queries'
import { useDeployments } from './deployments.queries'
import { type StatusTone, statusTone } from './deployments.status'
import DeployDialog from './DeployDialog.vue'
import { useDatabases } from '@/features/databases/databases.queries'
import StatusBadge from '@/features/databases/StatusBadge.vue'
import { databaseTone, titleCase } from '@/features/databases/databases.status'
import CreateDatabaseDialog from '@/features/databases/CreateDatabaseDialog.vue'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { Deployment, ManagedDatabase } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ projectId: string; envId: string }>()
const router = useRouter()

const { data: project } = useProject(() => props.projectId)
const env = computed(() => project.value?.environments?.find((e) => e.id === props.envId))

const { data: databases, isPending: dbPending, isError: dbError } = useDatabases(() => props.envId)
const showCreateDb = ref(false)
function onDbCreated(db: ManagedDatabase) {
  router.push(`/projects/${props.projectId}/env/${props.envId}/databases/${db.id}`)
}

const {
  data: deployments,
  isPending,
  isError,
  error,
  refetch,
} = useDeployments(() => props.envId)

const showDeploy = ref(false)
function onDeployed(dep: Deployment) {
  router.push(`/deployments/${dep.id}`)
}

const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : '—')

const dotClass: Record<StatusTone, string> = {
  queued: 'bg-muted-foreground/40',
  active: 'bg-primary animate-pulse',
  success: 'bg-success',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground/40',
}

const sourceOf = (d: Deployment) => d.branches?.find((b) => b.role === 'SOURCE') ?? null
const mergeCount = (d: Deployment) => d.branches?.filter((b) => b.role === 'MERGE').length ?? 0
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
    <RouterLink
      :to="`/projects/${projectId}`"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Project
    </RouterLink>

    <header class="mt-4 flex items-start justify-between gap-4">
      <div class="flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">
          {{ env?.name ?? 'Environment' }}
        </h1>
        <Badge v-if="env" variant="secondary" class="font-mono">{{ env.branch ?? '—' }}</Badge>
      </div>
      <Button @click="showDeploy = true">
        <Rocket />
        Deploy
      </Button>
    </header>
    <p class="mt-1 text-sm text-muted-foreground">
      Deploys the latest commit on
      <span class="font-mono">{{ env?.branch ?? 'the branch' }}</span>.
    </p>

    <section class="mt-8">
      <h2 class="text-sm font-semibold tracking-tight text-foreground">
        Deployments
        <span v-if="deployments?.length" class="ml-1 text-muted-foreground/60">
          {{ deployments.length }}
        </span>
      </h2>

      <!-- loading -->
      <div v-if="isPending" class="mt-3 overflow-hidden rounded-xl border border-border">
        <div
          v-for="n in 4"
          :key="n"
          class="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
        >
          <Skeleton class="size-2.5 rounded-full" />
          <Skeleton class="h-3 w-14" />
          <Skeleton class="h-3 flex-1" />
          <Skeleton class="h-3 w-12" />
        </div>
      </div>

      <!-- error -->
      <div
        v-else-if="isError"
        class="mt-3 flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center"
      >
        <p class="text-sm text-destructive">{{ apiErrorMessage(error) }}</p>
        <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
          <RotateCcw />
          Retry
        </Button>
      </div>

      <!-- empty -->
      <div
        v-else-if="!deployments || deployments.length === 0"
        class="mt-3 rounded-xl border border-dashed border-border py-16 text-center"
      >
        <h3 class="text-base font-medium text-foreground">No deployments yet</h3>
        <p class="mt-1 text-sm text-muted-foreground">Hit Deploy to ship the latest commit.</p>
      </div>

      <!-- list -->
      <div v-else class="mt-3 overflow-hidden rounded-xl border border-border">
        <RouterLink
          v-for="d in deployments"
          :key="d.id"
          :to="`/deployments/${d.id}`"
          :title="titleCase(d.status)"
          class="group flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 transition-colors last:border-b-0 hover:bg-accent/40"
        >
          <span class="size-2.5 shrink-0 rounded-full" :class="dotClass[statusTone[d.status]]" />
          <span v-if="d.commitSha" class="shrink-0 font-mono text-xs text-muted-foreground/70">
            {{ shortSha(d.commitSha) }}
          </span>
          <span class="min-w-0 flex-1 truncate text-sm text-foreground/90">
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
          <span class="shrink-0 text-xs text-muted-foreground/60">
            {{ relativeTime(d.createdAt) }}
          </span>
        </RouterLink>
      </div>
    </section>

    <!-- databases -->
    <section class="mt-10">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Databases</h2>
        <Button size="sm" variant="outline" :disabled="!project" @click="showCreateDb = true">
          <Plus />
          Add database
        </Button>
      </div>

      <!-- loading -->
      <div v-if="dbPending" class="mt-3 space-y-2">
        <Skeleton v-for="n in 2" :key="n" class="h-14 w-full rounded-lg" />
      </div>

      <p v-else-if="dbError" class="mt-3 text-sm text-destructive">Could not load databases.</p>

      <!-- empty -->
      <div
        v-else-if="!databases || databases.length === 0"
        class="mt-3 rounded-xl border border-dashed border-border py-12 text-center"
      >
        <Database class="mx-auto size-5 text-muted-foreground" />
        <p class="mt-2 text-sm text-muted-foreground">
          No databases. Add one to give this environment persistence.
        </p>
      </div>

      <!-- list -->
      <div
        v-else
        class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        <RouterLink
          v-for="db in databases"
          :key="db.id"
          :to="`/projects/${projectId}/env/${envId}/databases/${db.id}`"
          class="flex items-center gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
        >
          <StatusBadge :tone="databaseTone[db.status]" :label="titleCase(db.status)" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm text-foreground">{{ db.name }}</p>
            <p class="mt-0.5 truncate text-xs text-muted-foreground">
              {{ db.type }} {{ db.version }}
              <span v-if="!db.ownsContainer"> · attached</span>
            </p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground" />
        </RouterLink>
      </div>
    </section>

    <CreateDatabaseDialog
      v-if="project"
      v-model:open="showCreateDb"
      :project="project"
      :env-id="envId"
      @created="onDbCreated"
    />

    <DeployDialog
      v-model:open="showDeploy"
      :project-id="projectId"
      :env-id="envId"
      :default-branch="env?.branch ?? null"
      @deployed="onDeployed"
    />
  </div>
</template>

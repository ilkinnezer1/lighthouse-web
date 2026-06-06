<script setup lang="ts">
import { useRouter } from 'vue-router'
import { GitBranch, GitMerge, Rocket, RotateCcw } from '@lucide/vue'
import { useAllDeployments } from './deployments.queries'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { DeploymentListItem } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const router = useRouter()
const { data: deployments, isPending, isError, error, refetch } = useAllDeployments()

function sourceOf(d: DeploymentListItem) {
  return d.branches.find((b) => b.role === 'SOURCE') ?? null
}

function mergeCount(d: DeploymentListItem) {
  return d.branches.filter((b) => b.role === 'MERGE').length
}

const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : null)

function goToDeployment(id: string) {
  router.push(`/deployments/${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Deployments</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Every deployment across your projects, newest first.
        </p>
      </div>
    </header>

    <div v-if="isPending" class="mt-8 space-y-3">
      <div
        v-for="n in 4"
        :key="n"
        class="flex items-center gap-4 rounded-xl border border-border p-5"
      >
        <Skeleton class="h-6 w-24 rounded-full" />
        <div class="flex-1 space-y-2">
          <Skeleton class="h-4 w-56" />
          <Skeleton class="h-3 w-40" />
        </div>
        <Skeleton class="h-4 w-16" />
      </div>
    </div>

    <div
      v-else-if="isError"
      class="mt-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(error) }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <div
      v-else-if="!deployments || deployments.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <Rocket class="size-6 text-primary" />
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No deployments yet</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Deploy an environment and it will show up here.
      </p>
    </div>

    <div v-else class="mt-8 space-y-3">
      <button
        v-for="d in deployments"
        :key="d.id"
        type="button"
        class="group flex w-full items-center gap-4 rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:border-primary focus-visible:outline-none"
        @click="goToDeployment(d.id)"
      >
        <DeploymentStatusBadge :status="d.status" />

        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate font-medium text-foreground">
              {{ d.environment.project.name }}
            </span>
            <span aria-hidden class="text-muted-foreground/50">/</span>
            <Badge variant="secondary" class="font-mono">{{ d.environment.name }}</Badge>
          </div>
          <p class="mt-1 truncate text-sm text-muted-foreground">
            {{ d.commitMessage ?? 'No commit message' }}
          </p>
        </div>

        <div class="hidden shrink-0 items-center gap-2 sm:flex">
          <span
            v-if="sourceOf(d)"
            class="inline-flex items-center gap-1 font-mono text-xs text-muted-foreground"
          >
            <GitBranch class="size-3.5" />
            {{ sourceOf(d)?.name }}
          </span>
          <span
            v-if="mergeCount(d) > 0"
            class="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
          >
            <GitMerge class="size-3.5" />
            +{{ mergeCount(d) }}
          </span>
        </div>

        <div class="shrink-0 text-right">
          <span v-if="shortSha(d.commitSha)" class="font-mono text-xs text-muted-foreground">
            {{ shortSha(d.commitSha) }}
          </span>
          <p class="mt-0.5 text-xs text-muted-foreground">{{ relativeTime(d.createdAt) }}</p>
        </div>
      </button>
    </div>
  </div>
</template>

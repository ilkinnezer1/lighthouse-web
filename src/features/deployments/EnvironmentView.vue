<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowLeft, Rocket, RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useProject } from '@/features/projects/projects.queries'
import { useCreateDeployment, useDeployments } from './deployments.queries'
import DeploymentStatusBadge from './DeploymentStatusBadge.vue'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ projectId: string; envId: string }>()
const router = useRouter()

const { data: project } = useProject(() => props.projectId)
const env = computed(() => project.value?.environments?.find((e) => e.id === props.envId))

const {
  data: deployments,
  isPending,
  isError,
  error,
  refetch,
} = useDeployments(() => props.envId)
const createDeployment = useCreateDeployment(() => props.envId)

async function onDeploy() {
  try {
    const dep = await createDeployment.mutateAsync()
    toast.success('Deployment queued')
    router.push(`/deployments/${dep.id}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not start deployment'))
  }
}

const shortSha = (sha: string | null) => (sha ? sha.slice(0, 7) : '—')
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
      <Button :disabled="createDeployment.isPending.value" @click="onDeploy">
        <Rocket />
        Deploy
      </Button>
    </header>
    <p class="mt-1 text-sm text-muted-foreground">
      Deploys the latest commit on
      <span class="font-mono">{{ env?.branch ?? 'the branch' }}</span>.
    </p>

    <!-- loading -->
    <div v-if="isPending" class="mt-8 space-y-2">
      <Skeleton v-for="n in 3" :key="n" class="h-16 w-full rounded-lg" />
    </div>

    <!-- error -->
    <div
      v-else-if="isError"
      class="mt-8 flex flex-col items-center rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center"
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
      class="mt-8 rounded-xl border border-dashed border-border py-16 text-center"
    >
      <h2 class="text-base font-medium text-foreground">No deployments yet</h2>
      <p class="mt-1 text-sm text-muted-foreground">Hit Deploy to ship the latest commit.</p>
    </div>

    <!-- timeline -->
    <div v-else class="mt-8 divide-y divide-border overflow-hidden rounded-xl border border-border">
      <RouterLink
        v-for="d in deployments"
        :key="d.id"
        :to="`/deployments/${d.id}`"
        class="flex items-center gap-4 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
      >
        <DeploymentStatusBadge :status="d.status" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm text-foreground">
            <span class="font-mono text-muted-foreground">{{ shortSha(d.commitSha) }}</span>
            <span class="ml-2">{{ d.commitMessage ?? 'No commit message' }}</span>
          </p>
          <p class="mt-0.5 truncate text-xs text-muted-foreground">
            {{ d.commitAuthor ?? 'unknown' }} · {{ relativeTime(d.createdAt) }}
          </p>
        </div>
      </RouterLink>
    </div>
  </div>
</template>

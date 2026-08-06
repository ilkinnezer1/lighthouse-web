<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ChevronRight, Plus, Rocket } from '@lucide/vue'
import { useProject } from '@/features/projects/projects.queries'
import { useDeployments } from './deployments.queries'
import DeploymentRow from './DeploymentRow.vue'
import DeployDialog from './DeployDialog.vue'
import { useDatabases } from '@/features/databases/databases.queries'
import StatusBadge from '@/features/databases/StatusBadge.vue'
import { databaseTone, titleCase } from '@/features/databases/databases.status'
import CreateDatabaseDialog from '@/features/databases/CreateDatabaseDialog.vue'
import ResetEnvironmentButton from '@/features/databases/ResetEnvironmentButton.vue'
import EnvVarsSection from '@/features/env-vars/EnvVarsSection.vue'
import EnvFilesSection from '@/features/env-files/EnvFilesSection.vue'
import VolumesSection from '@/features/volumes/VolumesSection.vue'
import VolumeBackupsSection from '@/features/volumes/VolumeBackupsSection.vue'
import DomainSection from '@/features/domains/DomainSection.vue'
import FileExplorerSection from '@/features/env-files/FileExplorerSection.vue'
import ScheduledTasksSection from '@/features/scheduled-tasks/ScheduledTasksSection.vue'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import type { Deployment, ManagedDatabase } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  Breadcrumb,
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
} from '@/components/ui/section'

const props = defineProps<{ projectId: string; envId: string }>()
const router = useRouter()

const { data: project } = useProject(() => props.projectId)
const env = computed(() => project.value?.environments?.find((e) => e.id === props.envId))

const {
  data: databases,
  isPending: dbPending,
  isError: dbError,
  refetch: refetchDbs,
} = useDatabases(() => props.envId)
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

// Service names for the task picker, taken from the newest deployment we know about.
const serviceNames = computed(() => {
  const names = (deployments.value ?? [])
    .flatMap((d) => d.services ?? [])
    .map((s) => s.name)
  return names.length ? [...new Set(names)] : ['web']
})

const canDeploy = useCan('deploy')
const canManageEnv = useCan('env.manage')
</script>

<template>
  <PageShell>
    <Breadcrumb
      :items="[
        { label: 'Projects', to: '/' },
        { label: project?.name ?? 'Project', to: `/projects/${projectId}` },
        { label: env?.name ?? 'environment', mono: true },
      ]"
    />

    <PageHead eyebrow="Environment" :title="env?.name ?? 'Environment'" class="mt-5">
      <template #deck>
        Deploys the latest commit on
        <span class="font-mono text-ink-2">{{ env?.branch ?? 'the branch' }}</span>.
      </template>
      <template #actions>
        <Button v-if="canDeploy" size="sm" @click="showDeploy = true">
          <Rocket />
          Deploy
        </Button>
      </template>
    </PageHead>

    <section class="mt-12">
      <SectionHead eyebrow="Deployments" :count="deployments?.length ?? 0" />

      <LoadingRows v-if="isPending" :rows="4" />

      <ErrorState
        v-else-if="isError"
        :message="apiErrorMessage(error, 'Could not load deployments.')"
        @retry="() => refetch()"
      />

      <EmptyState
        v-else-if="!deployments || deployments.length === 0"
        title="Nothing deployed yet"
        deck="Ship the latest commit on this branch to see it here."
      >
        <template #action>
          <Button v-if="canDeploy" size="sm" @click="showDeploy = true">
            <Rocket />
            Deploy
          </Button>
        </template>
      </EmptyState>

      <div v-else class="rule-y">
        <DeploymentRow
          v-for="d in deployments"
          :key="d.id"
          :to="`/deployments/${d.id}`"
          :status="d.status"
          :commit-sha="d.commitSha"
          :commit-message="d.commitMessage"
          :created-at="d.createdAt"
          :branches="d.branches"
          time="relative"
        />
      </div>
    </section>

    <DomainSection :env-id="envId" class="mt-10 block" />

    <ScheduledTasksSection :env-id="envId" :services="serviceNames" class="mt-10 block" />

    <EnvVarsSection :env-id="envId" class="mt-10 block" />

    <VolumesSection :env-id="envId" class="mt-10 block" />

    <VolumeBackupsSection :env-id="envId" class="mt-10 block" />

    <EnvFilesSection :env-id="envId" class="mt-10 block" />

    <FileExplorerSection :env-id="envId" class="mt-10 block" />

    <!-- databases -->
    <section class="mt-10">
      <SectionHead eyebrow="Databases" :count="databases?.length ?? 0">
        <template #actions>
          <ResetEnvironmentButton :env-id="envId" :database-count="databases?.length ?? 0" />
          <Button
            v-if="canManageEnv"
            size="sm"
            variant="outline"
            :disabled="!project"
            @click="showCreateDb = true"
          >
            <Plus />
            Add database
          </Button>
        </template>
      </SectionHead>

      <LoadingRows v-if="dbPending" :rows="2" />

      <ErrorState
        v-else-if="dbError"
        message="Could not load databases."
        @retry="() => refetchDbs()"
      />

      <EmptyState
        v-else-if="!databases || databases.length === 0"
        title="No databases"
        deck="Add one to give this environment persistence."
      >
        <template #action>
          <Button
            v-if="canManageEnv"
            size="sm"
            variant="outline"
            :disabled="!project"
            @click="showCreateDb = true"
          >
            <Plus />
            Add database
          </Button>
        </template>
      </EmptyState>

      <div v-else class="rule-y">
        <RouterLink
          v-for="db in databases"
          :key="db.id"
          :to="`/projects/${projectId}/env/${envId}/databases/${db.id}`"
          class="flex items-center gap-3 py-3 transition-colors hover:bg-accent/40"
        >
          <StatusBadge :tone="databaseTone[db.status]" :label="titleCase(db.status)" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm text-ink-1">{{ db.name }}</p>
            <p class="mt-0.5 truncate text-xs text-ink-4">
              {{ db.type }} {{ db.version }}
              <span v-if="!db.ownsContainer"> · attached</span>
            </p>
          </div>
          <ChevronRight class="size-4 text-ink-4" />
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
  </PageShell>
</template>

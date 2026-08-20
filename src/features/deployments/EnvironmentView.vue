<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ChevronRight, Plus, Rocket } from '@lucide/vue'
import { useProject } from '@/features/projects/projects.queries'
import { useDeployments } from './deployments.queries'
import DeploymentRow from './DeploymentRow.vue'
import DeployDialog from './DeployDialog.vue'
import { useDatabases } from '@/features/databases/databases.queries'
import StatusBadge from '@/features/databases/StatusBadge.vue'
import { databaseDisplay } from '@/features/databases/databases.status'
import CreateDatabaseDialog from '@/features/databases/CreateDatabaseDialog.vue'
import ResetEnvironmentButton from '@/features/databases/ResetEnvironmentButton.vue'
import EnvVarsSection from '@/features/env-vars/EnvVarsSection.vue'
import EnvFilesSection from '@/features/env-files/EnvFilesSection.vue'
import VolumesSection from '@/features/volumes/VolumesSection.vue'
import VolumeBackupsSection from '@/features/volumes/VolumeBackupsSection.vue'
import { useVolumeBackups } from '@/features/volumes/backups.queries'
import DomainSection from '@/features/domains/DomainSection.vue'
import FileExplorerSection from '@/features/env-files/FileExplorerSection.vue'
import ScheduledTasksSection from '@/features/scheduled-tasks/ScheduledTasksSection.vue'
import EnvironmentLockControl from '@/features/environments/EnvironmentLockControl.vue'
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
  SectionTabs,
} from '@/components/ui/section'

const props = defineProps<{ projectId: string; envId: string }>()
const router = useRouter()
const route = useRoute()

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
  void router.push(`/projects/${props.projectId}/env/${props.envId}/databases/${db.id}`)
}

const { data: deployments, isPending, isError, error, refetch } = useDeployments(() => props.envId)

const showDeploy = ref(false)
function onDeployed(dep: Deployment) {
  void router.push(`/deployments/${dep.id}`)
}

// Service names for the task picker, taken from the newest deployment we know about.
const serviceNames = computed(() => {
  const names = (deployments.value ?? []).flatMap((d) => d.services ?? []).map((s) => s.name)
  return names.length ? [...new Set(names)] : ['web']
})

// The reset button needs to know whether any volume has a baseline: an
// environment can hold all its state in volumes and no databases at all.
const { data: volumeBackups } = useVolumeBackups(() => props.envId)
const volumeBaselineCount = computed(
  () => (volumeBackups.value ?? []).filter((b) => b.isBaseline).length,
)

const canDeploy = useCan('deploy')
const canManageEnv = useCan('env.manage')

/**
 * The page was one scroll of nine sections with databases and "Reset data" last,
 * below the file tree — the two things anyone testing an environment reaches for
 * most, behind the heaviest thing on the page. Grouping puts them one click away
 * and keeps the tree from separating them from everything else.
 */
const TABS = [
  { key: 'deployments', label: 'Deployments' },
  { key: 'data', label: 'Data' },
  { key: 'config', label: 'Config' },
  { key: 'files', label: 'Files' },
]

// Kept in the query string so a tab is linkable and survives a reload.
const tab = computed({
  get: () => {
    const q = route.query.tab
    const key = Array.isArray(q) ? q[0] : q
    return TABS.some((t) => t.key === key) ? (key as string) : 'deployments'
  },
  // replace, not push: flipping tabs is not navigation worth stacking in
  // history, and back should leave the page rather than walk the tabs.
  set: (key: string) => void router.replace({ query: { ...route.query, tab: key } }),
})

const tabsWithCounts = computed(() =>
  TABS.map((t) =>
    t.key === 'deployments'
      ? { ...t, count: deployments.value?.length ?? null }
      : t.key === 'data'
        ? { ...t, count: databases.value?.length ?? null }
        : t,
  ),
)
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
        <span class="font-mono text-ink-2">{{ env?.branch ?? 'the branch' }}</span
        >.
      </template>
      <template #actions>
        <EnvironmentLockControl
          v-if="env"
          :env-id="envId"
          :project-id="projectId"
          :lock="env.lock"
        />
        <Button v-if="canDeploy" size="sm" @click="showDeploy = true">
          <Rocket />
          Deploy
        </Button>
      </template>
    </PageHead>

    <SectionTabs v-model="tab" :tabs="tabsWithCounts" class="mt-10" />

    <!-- No section head: the tab already carries this label and count. -->
    <section v-if="tab === 'deployments'" class="mt-6">
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

    <template v-if="tab === 'config'">
      <DomainSection :env-id="envId" class="mt-8 block" />

      <EnvVarsSection :env-id="envId" class="mt-10 block" />

      <ScheduledTasksSection :env-id="envId" :services="serviceNames" class="mt-10 block" />
    </template>

    <template v-if="tab === 'files'">
      <EnvFilesSection :env-id="envId" class="mt-8 block" />

      <FileExplorerSection :env-id="envId" class="mt-10 block" />
    </template>

    <!-- databases lead the Data tab: resetting an environment starts here -->
    <section v-if="tab === 'data'" class="mt-8">
      <SectionHead eyebrow="Databases" :count="databases?.length ?? 0">
        <template #actions>
          <ResetEnvironmentButton
            :env-id="envId"
            :database-count="databases?.length ?? 0"
            :volume-baseline-count="volumeBaselineCount"
          />
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
          <StatusBadge :tone="databaseDisplay(db).tone" :label="databaseDisplay(db).label" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-mono text-sm text-ink-1">{{ db.name }}</p>
            <p class="mt-0.5 truncate text-xs text-ink-4">
              {{ db.type }} {{ db.version }}
              <span v-if="!db.ownsContainer"> · attached</span>
              <span v-else-if="db.containerRunning === false" class="text-ink-3">
                · container not running
              </span>
            </p>
          </div>
          <ChevronRight class="size-4 text-ink-4" />
        </RouterLink>
      </div>
    </section>

    <template v-if="tab === 'data'">
      <VolumesSection :env-id="envId" class="mt-10 block" />

      <VolumeBackupsSection :env-id="envId" class="mt-10 block" />
    </template>

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

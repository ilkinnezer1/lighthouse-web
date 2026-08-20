<script setup lang="ts">
import { computed } from 'vue'
import { useDeployment } from './deployments.queries'
import { isTerminalStatus } from './deployments.status'
import { isServiceDown, useServiceTones } from './serviceTones'
import DeploymentHeader from './DeploymentHeader.vue'
import DeploymentBranches from './DeploymentBranches.vue'
import DeploymentChanges from './DeploymentChanges.vue'
import DeploymentFindings from '@/features/findings/DeploymentFindings.vue'
import DeploymentFailure from './DeploymentFailure.vue'
import DeploymentStages from './DeploymentStages.vue'
import DeploymentServices from './DeploymentServices.vue'
import DeploymentMaintenance from './DeploymentMaintenance.vue'
import DeploymentLogPane from './DeploymentLogPane.vue'
import { apiErrorMessage } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState, PageShell } from '@/components/ui/section'

const props = defineProps<{ id: string }>()

const { data: deployment, isPending, isError, error, refetch } = useDeployment(() => props.id)

const { tones, setTone } = useServiceTones()

const isActive = computed(() => !!deployment.value && !isTerminalStatus(deployment.value.status))
const webService = computed(() => deployment.value?.services?.find((s) => s.isWeb) ?? null)
const webOffline = computed(
  () => !!webService.value && isServiceDown(tones.value, webService.value),
)
</script>

<template>
  <PageShell>
    <!-- loading -->
    <div v-if="isPending" class="space-y-6">
      <Skeleton class="h-8 w-64" />
      <Skeleton class="h-24 w-full rounded-xl" />
      <Skeleton class="h-96 w-full rounded-xl" />
    </div>

    <!-- error -->
    <ErrorState
      v-else-if="isError || !deployment"
      class="mt-10"
      :message="apiErrorMessage(error, 'Deployment not found.')"
      @retry="() => refetch()"
    />

    <template v-else>
      <DeploymentHeader
        :deployment="deployment"
        :is-active="isActive"
        :web-offline="webOffline"
        @refetch="() => refetch()"
      />

      <DeploymentFailure :summary="deployment.errorSummary" />

      <DeploymentBranches
        :branches="deployment.branches ?? []"
        :project-id="deployment.environment?.projectId ?? ''"
        :jira-site-url="deployment.environment?.project?.organization?.atlassianSiteUrl"
      />

      <DeploymentChanges :deployment-id="deployment.id" :has-commit="!!deployment.commitSha" />

      <DeploymentFindings :deployment="deployment" />

      <DeploymentStages :stages="deployment.stages ?? []" :is-active="isActive" />

      <DeploymentServices
        :deployment-id="props.id"
        :services="deployment.services ?? []"
        :tones="tones"
        @tone="setTone"
      />

      <DeploymentMaintenance :deployment-id="props.id" />

      <DeploymentLogPane
        :deployment-id="props.id"
        :deployment="deployment"
        :is-active="isActive"
        :tones="tones"
      />
    </template>
  </PageShell>
</template>

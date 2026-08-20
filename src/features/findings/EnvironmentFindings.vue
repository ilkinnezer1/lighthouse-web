<script setup lang="ts">
import { computed } from 'vue'
import { useEnvironmentFindings } from './findings.queries'
import { FINDING_STATUSES, findingStatusLabel } from './findings.format'
import { currentBuild } from './findings.staleness'
import FindingRow from './FindingRow.vue'
import { useDeployments } from '@/features/deployments/deployments.queries'
import { useCan } from '@/features/orgs/useCan'
import { useSelectFilter } from '@/lib/feed'
import { apiErrorMessage } from '@/lib/api'
import type { FindingStatus } from '@/types/api'
import { EmptyState, ErrorState, LoadingRows } from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{ envId: string }>()

const [statusFilter, status] = useSelectFilter<FindingStatus>()
const query = useEnvironmentFindings(() => props.envId, status)
const findings = computed(() => query.data.value ?? [])

// What this environment is actually serving — the newest build that succeeded,
// which is what every finding here is measured against.
const { data: deployments } = useDeployments(() => props.envId)
const current = computed(() => currentBuild(deployments.value))

const canResolve = useCan('deploy')
</script>

<template>
  <section class="mt-6">
    <div v-if="findings.length || statusFilter !== 'all'" class="flex justify-end">
      <Select v-model="statusFilter">
        <SelectTrigger class="h-8 w-40 text-xs" aria-label="Filter by status">
          <SelectValue placeholder="All findings" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All findings</SelectItem>
          <SelectItem v-for="s in FINDING_STATUSES" :key="s" :value="s">
            {{ findingStatusLabel[s] }}
          </SelectItem>
        </SelectContent>
      </Select>
    </div>

    <LoadingRows v-if="query.isPending.value" :rows="3" class="mt-4" />

    <ErrorState
      v-else-if="query.isError.value"
      class="mt-4"
      :message="apiErrorMessage(query.error.value, 'Could not load findings.')"
      @retry="() => query.refetch()"
    />

    <EmptyState
      v-else-if="findings.length === 0 && statusFilter !== 'all'"
      class="mt-4"
      title="Nothing in that state"
      deck="Widen the filter to see the rest of this environment's findings."
    />

    <EmptyState
      v-else-if="findings.length === 0"
      title="No findings here"
      deck="Findings are reported from a deployment, so each one stays pinned to the build it was seen on."
    />

    <div v-else class="mt-2 rule-y">
      <FindingRow
        v-for="f in findings"
        :key="f.id"
        :finding="f"
        :current="current"
        :can-resolve="canResolve"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Flag, Plus } from '@lucide/vue'
import { useDeploymentFindings } from './findings.queries'
import { openCount } from './findings.format'
import FindingRow from './FindingRow.vue'
import FileFindingDialog from './FileFindingDialog.vue'
import { useCan } from '@/features/orgs/useCan'
import type { Deployment } from '@/types/api'
import { Button } from '@/components/ui/button'

const props = defineProps<{ deployment: Deployment }>()

const query = useDeploymentFindings(() => props.deployment.id)
const findings = computed(() => query.data.value ?? [])
const open = computed(() => openCount(findings.value))

const canFile = useCan('deploy')
const showFile = ref(false)

// `?finding=<id>` is how an inbox notification points at one row — the finding
// lives on its build's page rather than owning a route of its own.
const route = useRoute()
const focusId = computed(() => {
  const q = route.query.finding
  return (Array.isArray(q) ? q[0] : q) ?? null
})
</script>

<template>
  <!--
    Most builds have none, so the zero case is a single dim line rather than a
    panel: the section has to earn its space on the page, and the only thing it
    owes a clean build is somewhere obvious to start.
  -->
  <section class="mt-6">
    <div class="flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
        <Flag class="size-3.5 text-muted-foreground" />
        Findings
        <span v-if="open" class="font-mono text-xs font-normal text-signal-error">
          {{ open }} open
        </span>
      </h2>

      <Button v-if="canFile" variant="ghost" size="sm" @click="showFile = true">
        <Plus />
        Report a finding
      </Button>
    </div>

    <p v-if="query.isError.value" class="mt-2 text-xs text-ink-4">Could not load findings.</p>

    <p v-else-if="!query.isPending.value && findings.length === 0" class="mt-2 text-xs text-ink-4">
      Nothing reported on this build.
    </p>

    <div v-else-if="findings.length" class="mt-1 rule-y">
      <FindingRow
        v-for="f in findings"
        :key="f.id"
        :finding="f"
        :focused="f.id === focusId"
        :can-resolve="canFile"
      />
    </div>

    <FileFindingDialog v-model:open="showFile" :deployment="deployment" />
  </section>
</template>

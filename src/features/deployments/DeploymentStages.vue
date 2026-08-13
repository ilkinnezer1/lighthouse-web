<script setup lang="ts">
import type { DeploymentStage, DeploymentStageStatus } from '@/types/api'
import { stageTone, statusDotClass, statusTextClass, titleCase } from './deployments.status'
import { durationLabel } from '@/lib/time'

const props = defineProps<{ stages: DeploymentStage[]; isActive: boolean }>()

/*
 * A stage left PENDING on a deployment that has already finished never ran —
 * it was skipped. Rendering it as "Pending" forever makes a completed deploy
 * look hung, which is the single most confusing thing on this page.
 */
function stageLabel(status: DeploymentStageStatus): string {
  if (status === 'PENDING' && !props.isActive) return 'Skipped'
  return titleCase(status)
}
function stageDisplayTone(status: DeploymentStageStatus) {
  return stageTone[status === 'PENDING' && !props.isActive ? 'SKIPPED' : status]
}
</script>

<template>
  <section v-if="stages.length" class="mt-6">
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Stages</h2>
    <ol class="mt-3 overflow-hidden rounded-xl border border-border">
      <li
        v-for="stage in stages"
        :key="stage.id"
        class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
        :class="stageLabel(stage.status) === 'Skipped' && 'opacity-55'"
      >
        <span class="size-2 rounded-full" :class="statusDotClass[stageDisplayTone(stage.status)]" />
        <span class="flex-1 font-mono text-sm text-foreground">{{ stage.name }}</span>
        <span class="font-mono text-xs text-ink-4">
          {{ durationLabel(stage.startedAt, stage.finishedAt) }}
        </span>
        <span
          class="w-20 text-right text-xs font-medium"
          :class="statusTextClass[stageDisplayTone(stage.status)]"
        >
          {{ stageLabel(stage.status) }}
        </span>
      </li>
    </ol>
  </section>
</template>

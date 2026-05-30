<script setup lang="ts">
import { computed, type Component } from 'vue'
import { Ban, CircleCheck, CircleX, Clock, LoaderCircle } from '@lucide/vue'
import type { DeploymentStatus } from '@/types/api'
import { type StatusTone, statusTone, titleCase } from './deployments.status'

const props = defineProps<{ status: DeploymentStatus }>()
const tone = computed<StatusTone>(() => statusTone[props.status])

const toneClass: Record<StatusTone, string> = {
  queued: 'bg-muted text-muted-foreground',
  active: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  error: 'bg-destructive/15 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}
const toneIcon: Record<StatusTone, Component> = {
  queued: Clock,
  active: LoaderCircle,
  success: CircleCheck,
  error: CircleX,
  neutral: Ban,
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      toneClass[tone],
    ]"
  >
    <component :is="toneIcon[tone]" class="size-3.5" :class="{ 'animate-spin': tone === 'active' }" />
    {{ titleCase(status) }}
  </span>
</template>

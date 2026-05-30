<script setup lang="ts">
import { type StatusTone, toneClass, toneIcon } from './databases.status'

defineProps<{ tone: StatusTone; label: string }>()
</script>

<template>
  <span
    :class="[
      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
      toneClass[tone],
    ]"
  >
    <component
      :is="toneIcon[tone]"
      class="size-3.5"
      :class="{ 'animate-spin': tone === 'active' }"
    />
    {{ label }}
  </span>
</template>

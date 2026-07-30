<script setup lang="ts">
import { RouterLink } from 'vue-router'
import { ArrowLeft } from '@lucide/vue'

defineProps<{
  // Last entry is the current page and is not linked.
  items: { label: string; to?: string; mono?: boolean }[]
}>()
</script>

<template>
  <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-3">
    <ArrowLeft class="size-4 shrink-0" aria-hidden="true" />
    <template v-for="(item, i) in items" :key="i">
      <span v-if="i > 0" class="text-ink-4" aria-hidden="true">/</span>
      <RouterLink
        v-if="item.to"
        :to="item.to"
        class="truncate transition-colors hover:text-ink-1"
        :class="item.mono && 'font-mono'"
      >
        {{ item.label }}
      </RouterLink>
      <span
        v-else
        aria-current="page"
        class="truncate text-ink-2"
        :class="item.mono && 'font-mono'"
      >
        {{ item.label }}
      </span>
    </template>
  </nav>
</template>

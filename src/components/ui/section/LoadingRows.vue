<script setup lang="ts">
import { Skeleton } from '@/components/ui/skeleton'

withDefaults(defineProps<{ rows?: number; dot?: boolean }>(), { rows: 6, dot: true })
</script>

<template>
  <!--
    The skeleton mirrors the row it replaces, so the layout doesn't jump when
    data lands. A generic grey block just moves the flicker somewhere else.
  -->
  <div class="rule-y" aria-busy="true" aria-live="polite">
    <div v-for="n in rows" :key="n" class="flex items-center gap-3 py-4">
      <Skeleton v-if="dot" class="size-2 shrink-0 rounded-full" />
      <Skeleton class="h-4 w-44 shrink-0" />
      <Skeleton class="h-3 min-w-0 flex-1" />
      <Skeleton class="h-3 w-16 shrink-0" />
    </div>
    <span class="sr-only">Loading…</span>
  </div>
</template>

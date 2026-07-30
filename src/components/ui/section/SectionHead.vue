<script setup lang="ts">
defineProps<{
  eyebrow: string
  count?: number | string | null
}>()
</script>

<template>
  <div class="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
    <div class="flex items-baseline gap-2.5">
      <h2 class="eyebrow">{{ eyebrow }}</h2>
      <span v-if="count !== undefined && count !== null" class="font-mono text-xs text-ink-4">
        {{ count }}
      </span>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-1.5">
      <slot name="actions" />
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  deck?: string
}>()
</script>

<template>
  <header class="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
    <div class="min-w-0">
      <p v-if="eyebrow" class="eyebrow mb-2.5">{{ eyebrow }}</p>
      <h1 class="display text-[1.625rem] leading-[1.15] sm:text-[1.875rem]">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="deck || $slots.deck" class="mt-2 max-w-prose text-sm text-ink-3">
        <slot name="deck">{{ deck }}</slot>
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>

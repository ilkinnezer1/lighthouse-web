<script setup lang="ts">
defineProps<{
  title: string
  deck?: string
}>()
</script>

<template>
  <!--
    Texture, not a dashed box with an icon chip. The dot field is what keeps a
    nearly-empty panel from reading as unfinished.
  -->
  <div class="relative overflow-hidden rounded-lg bg-sunken px-6 py-16 text-center">
    <div
      class="pointer-events-none absolute inset-0 opacity-[0.55]"
      style="
        background-image: radial-gradient(currentColor 1px, transparent 1px);
        background-size: 14px 14px;
        color: var(--ink-4);
        mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, transparent 35%, black 100%);
      "
    />
    <div class="relative">
      <h3 class="display text-xl">{{ title }}</h3>
      <p v-if="deck || $slots.deck" class="mx-auto mt-1.5 max-w-sm text-sm text-ink-3">
        <slot name="deck">{{ deck }}</slot>
      </p>
      <div v-if="$slots.action" class="mt-6 flex justify-center">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>

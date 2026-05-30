<script setup lang="ts">
withDefaults(defineProps<{ size?: number; withWordmark?: boolean }>(), {
  size: 28,
  withWordmark: true,
})
</script>

<template>
  <span class="inline-flex select-none items-center gap-2.5">
    <svg :width="size" :height="size" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 6.6 L3.4 2.8 M12 6.6 L20.6 2.8"
        stroke-width="1.5"
        stroke-linecap="round"
        class="stroke-primary/60"
      />
      <circle cx="12" cy="6.7" r="2.1" class="fill-primary" />
      <path d="M9.3 8.9 h5.4 l1.2 9.7 h-7.8 z" class="fill-foreground/90" />
      <path
        d="M9.7 12.3 h4.6 M9.4 15.6 h5.2"
        stroke-width="1"
        class="stroke-background/70"
      />
      <rect x="6.6" y="18.4" width="10.8" height="1.9" rx="0.95" class="fill-muted-foreground" />
    </svg>
    <span
      v-if="withWordmark"
      class="text-[15px] font-semibold tracking-tight text-foreground"
    >
      Lighthouse
    </span>
  </span>
</template>

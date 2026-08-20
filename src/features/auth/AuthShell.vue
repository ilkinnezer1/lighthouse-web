<script setup lang="ts">
import AppLogo from '@/components/AppLogo.vue'

defineProps<{ title: string; subtitle?: string }>()
</script>

<template>
  <div class="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
    <!-- beacon panel -->
    <aside
      class="dark-surface relative hidden flex-col justify-between overflow-hidden border-r border-border p-10 lg:flex"
    >
      <div
        class="pointer-events-none absolute -top-28 left-1/3 h-110 w-110 -translate-x-1/2 rounded-full bg-primary/15 blur-[130px]"
      />
      <div
        class="pointer-events-none absolute left-[42%] top-8 h-[150%] w-[55%] -translate-x-1/2 rotate-16 bg-linear-to-b from-primary/12 via-primary/4 to-transparent blur-2xl"
      />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent via-border to-transparent"
      />

      <header class="relative z-10">
        <AppLogo :size="30" />
      </header>

      <div class="relative z-10 max-w-md">
        <h1
          class="text-balance text-[2rem] font-semibold leading-[1.15] tracking-tight text-foreground"
        >
          Ship preview environments from a single push.
        </h1>
        <p class="mt-4 leading-relaxed text-muted-foreground">
          Self-hosted deploys, managed databases, snapshots and live build logs — your own Vercel,
          on your own box.
        </p>
      </div>

      <footer class="relative z-10 font-mono text-xs text-muted-foreground/70">
        lighthouse · self-hosted
      </footer>
    </aside>

    <!-- form panel -->
    <main class="flex items-center justify-center p-6 sm:p-10">
      <div class="w-full max-w-sm">
        <div class="mb-10 lg:hidden">
          <AppLogo :size="28" />
        </div>

        <div class="mb-6">
          <h2 class="text-xl font-semibold tracking-tight text-foreground">{{ title }}</h2>
          <p v-if="subtitle" class="mt-1.5 text-sm text-muted-foreground">{{ subtitle }}</p>
        </div>

        <slot />

        <div v-if="$slots.footer" class="mt-6 text-center text-sm text-muted-foreground">
          <slot name="footer" />
        </div>
      </div>
    </main>
  </div>
</template>

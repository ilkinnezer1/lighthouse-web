<script setup lang="ts">
import { computed, ref } from 'vue'
import { onKeyStroke } from '@vueuse/core'
import { LoaderCircle, RotateCw, SquareTerminal, X } from '@lucide/vue'
import { useServiceTerminal } from './useServiceTerminal'
import { Button } from '@/components/ui/button'
import '@xterm/xterm/css/xterm.css'

const props = defineProps<{
  deploymentId: string
  service: string | undefined
}>()

const open = defineModel<boolean>('open', { required: true })

const containerEl = ref<HTMLElement | null>(null)

const { status, errorMessage, retry } = useServiceTerminal(
  containerEl,
  () => props.deploymentId,
  () => props.service,
  { active: () => open.value },
)

const statusLabel = computed(
  () =>
    ({
      idle: 'idle',
      connecting: 'connecting…',
      ready: 'connected',
      closed: 'session ended',
      error: 'error',
    })[status.value],
)

const statusDot = computed(
  () =>
    ({
      idle: 'bg-muted-foreground/40',
      connecting: 'bg-primary animate-pulse',
      ready: 'bg-success',
      closed: 'bg-muted-foreground/40',
      error: 'bg-destructive',
    })[status.value],
)

onKeyStroke('Escape', () => {
  if (open.value) open.value = false
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[1px]"
        @click="open = false"
      />
    </Transition>

    <Transition
      enter-active-class="transition-transform duration-300 ease-out"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="translate-y-full"
      leave-to-class="translate-y-full"
    >
      <div
        v-if="open"
        class="fixed inset-x-0 bottom-0 z-50 flex h-[60vh] flex-col overflow-hidden rounded-t-2xl border-t border-border shadow-2xl"
        style="background: #0a0d14"
        role="dialog"
        aria-label="Service terminal"
      >
        <header
          class="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-2.5"
        >
          <div class="flex min-w-0 items-center gap-2">
            <SquareTerminal class="size-4 shrink-0 text-primary" />
            <span class="truncate font-mono text-sm text-foreground/90">
              {{ service ?? 'terminal' }}
            </span>
            <span class="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span class="size-1.5 rounded-full" :class="statusDot" />
              {{ statusLabel }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-0.5">
            <Button
              v-if="status === 'closed' || status === 'error'"
              variant="ghost"
              size="sm"
              class="text-muted-foreground hover:text-foreground"
              @click="retry"
            >
              <RotateCw />
              Reconnect
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-foreground"
              title="Close"
              @click="open = false"
            >
              <X />
            </Button>
          </div>
        </header>

        <div class="relative min-h-0 flex-1">
          <div ref="containerEl" class="absolute inset-0 px-3 py-2" />
          <div
            v-if="status === 'connecting'"
            class="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground"
          >
            <LoaderCircle class="size-4 animate-spin" />
            Attaching to {{ service }}…
          </div>
          <div
            v-else-if="status === 'error'"
            class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center"
          >
            <p class="max-w-sm text-sm text-destructive">
              {{ errorMessage ?? 'Could not start the terminal session.' }}
            </p>
            <Button variant="outline" size="sm" @click="retry">
              <RotateCw />
              Try again
            </Button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

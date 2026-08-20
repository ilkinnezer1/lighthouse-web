<script setup lang="ts">
import { computed } from 'vue'
import { Lock, LoaderCircle, TriangleAlert } from '@lucide/vue'
import {
  lockHolderName,
  lockRemainingLabel,
  lockRemainingMs,
} from '@/features/environments/environments.lock'
import { useNowMs } from '@/lib/clock'
import { clockTime, relativeTime } from '@/lib/time'
import type { EnvironmentLock } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{
  lock: EnvironmentLock | null
  pending?: boolean
  action?: string
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ override: [] }>()

const now = useNowMs()
const verb = computed(() => props.action ?? 'Deploy')
const holder = computed(() => (props.lock ? lockHolderName(props.lock.lockedBy) : ''))
const remaining = computed(() =>
  props.lock ? lockRemainingLabel(lockRemainingMs(props.lock, now.value)) : '',
)
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="lock" class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Lock class="size-4 text-signal-progress" />
          {{ holder }} is using this environment
        </DialogTitle>
        <DialogDescription>
          They locked it {{ relativeTime(lock.lockedAt) }} and it is theirs for another
          {{ remaining }}, until {{ clockTime(lock.expiresAt) }}.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-3 py-1">
        <div v-if="lock.reason" class="rounded-md border border-border bg-muted/40 px-3 py-2">
          <p class="text-xs text-ink-4">Reason</p>
          <p class="mt-0.5 text-sm text-ink-1">{{ lock.reason }}</p>
        </div>
        <p v-else class="text-sm text-ink-4">They did not give a reason.</p>

        <p class="flex items-start gap-2 text-xs text-muted-foreground">
          <TriangleAlert class="mt-0.5 size-3.5 shrink-0 text-signal-progress" />
          <span>
            This restarts the app and will break whatever they are in the middle of. Overriding is
            recorded against your name in the audit log.
          </span>
        </p>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="pending" @click="open = false">
          Leave it alone
        </Button>
        <Button variant="destructive" type="button" :disabled="pending" @click="emit('override')">
          <LoaderCircle v-if="pending" class="animate-spin" />
          {{ verb }} anyway
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

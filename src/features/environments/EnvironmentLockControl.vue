<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Lock, LockOpen, LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useLockEnvironment, useUnlockEnvironment } from './environments.queries'
import { lockHolderName, lockRemainingLabel, lockState } from './environments.lock'
import { useCan } from '@/features/orgs/useCan'
import { useAuthStore } from '@/features/auth/auth.store'
import { useNowMs } from '@/lib/clock'
import { apiErrorMessage } from '@/lib/api'
import { clockTime } from '@/lib/time'
import type { EnvironmentLock } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  envId: string
  projectId: string
  lock: EnvironmentLock | null
}>()

const auth = useAuthStore()
const now = useNowMs()
const canLock = useCan('env.manage')

const state = computed(() => lockState(props.lock, auth.user?.id, now.value))

const takeLock = useLockEnvironment(
  () => props.envId,
  () => props.projectId,
)
const releaseLock = useUnlockEnvironment(
  () => props.envId,
  () => props.projectId,
)
const busy = computed(() => takeLock.isPending.value || releaseLock.isPending.value)

const showTake = ref(false)
const showSteal = ref(false)
const reason = ref('')
const hours = ref('4')

const HOUR_OPTIONS = ['1', '2', '4', '8']

watch(showTake, (open) => {
  if (open) {
    reason.value = ''
    hours.value = '4'
  }
})

const holderName = computed(() =>
  state.value.kind === 'unlocked' ? '' : lockHolderName(state.value.lock.lockedBy),
)

const detail = computed(() => {
  if (state.value.kind === 'unlocked') return ''
  const { lock, remainingMs } = state.value
  return `${lockRemainingLabel(remainingMs)} left — until ${clockTime(lock.expiresAt)}`
})

async function onTake() {
  try {
    await takeLock.mutateAsync({
      reason: reason.value.trim() || undefined,
      hours: Number(hours.value),
    })
    showTake.value = false
    toast.success(`Locked for ${hours.value}h — deploys here now warn other people first`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not lock the environment'))
  }
}

async function onRelease(stolen: boolean) {
  const who = holderName.value
  try {
    await releaseLock.mutateAsync()
    showSteal.value = false
    toast.success(stolen ? `Released ${who}'s lock` : 'Lock released')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not release the lock'))
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-if="state.kind !== 'unlocked'">
      <span
        :class="[
          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
          state.kind === 'mine'
            ? 'bg-primary/10 text-primary'
            : 'bg-signal-progress/10 text-signal-progress',
        ]"
      >
        <Lock class="size-3.5" />
        {{ state.kind === 'mine' ? 'You have this locked' : `Locked by ${holderName}` }}
      </span>
      <span class="hidden text-xs text-ink-4 sm:inline">{{ detail }}</span>
    </template>

    <Button
      v-if="canLock && state.kind === 'unlocked'"
      size="sm"
      variant="outline"
      :disabled="busy"
      @click="showTake = true"
    >
      <LoaderCircle v-if="busy" class="animate-spin" />
      <Lock v-else />
      Lock
    </Button>

    <!-- Releasing your own lock is routine; taking someone else's is not. -->
    <Button
      v-else-if="canLock && state.kind === 'mine'"
      size="sm"
      variant="outline"
      :disabled="busy"
      @click="onRelease(false)"
    >
      <LoaderCircle v-if="busy" class="animate-spin" />
      <LockOpen v-else />
      Release
    </Button>

    <Button
      v-else-if="canLock"
      size="sm"
      variant="ghost"
      :disabled="busy"
      @click="showSteal = true"
    >
      <LockOpen />
      Release…
    </Button>
  </div>

  <Dialog v-model:open="showTake">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Lock this environment</DialogTitle>
        <DialogDescription>
          Everyone else still sees the environment and can still deploy — they get a warning naming
          you first, and overriding it is recorded.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <Label for="lock-reason">Reason <span class="text-ink-4">(optional)</span></Label>
          <Input
            id="lock-reason"
            v-model="reason"
            placeholder="Regression pass on checkout"
            maxlength="120"
            @keydown.enter.prevent="onTake"
          />
          <p class="text-xs text-muted-foreground">
            Shown to anyone who tries to deploy here. A reason saves them asking.
          </p>
        </div>

        <div class="grid gap-2">
          <Label for="lock-hours">Hold for</Label>
          <Select id="lock-hours" v-model="hours">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="h in HOUR_OPTIONS" :key="h" :value="h">
                {{ h }} hour{{ h === '1' ? '' : 's' }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            The lock expires on its own, so a forgotten one does not block the team.
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="busy" @click="showTake = false">
          Cancel
        </Button>
        <Button type="button" :disabled="busy" @click="onTake">
          <LoaderCircle v-if="busy" class="animate-spin" />
          <Lock v-else />
          Lock
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <AlertDialog v-model:open="showSteal">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Release {{ holderName }}'s lock?</AlertDialogTitle>
        <AlertDialogDescription>
          {{ holderName }} claimed this environment
          <template v-if="state.kind !== 'unlocked' && state.lock.reason">
            for <span class="text-ink-2">{{ state.lock.reason }}</span>
          </template>
          and has {{ detail }}. Releasing it now frees the environment for everyone — they may be
          mid-test. Ask them first if you can.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction :disabled="busy" @click="onRelease(true)">
          <LoaderCircle v-if="busy" class="animate-spin" />
          Release anyway
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

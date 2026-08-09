<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useResetEnvironment } from './snapshots.queries'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{
  envId: string
  databaseCount: number
  volumeBaselineCount?: number
}>()

// Show the button when there is anything to reset. Gating on databases alone
// hid it from environments whose state lives entirely in volumes.
const hasTargets = computed(
  () => props.databaseCount > 0 || (props.volumeBaselineCount ?? 0) > 0,
)

const reset = useResetEnvironment(() => props.envId)
// Client gating is cosmetic; the API enforces snapshots.restore.
const canReset = useCan('env.manage')
const busy = computed(() => reset.isPending.value)

async function onReset() {
  try {
    const res = await reset.mutateAsync()
    const restored = [
      ...res.restored.map((r) => r.database),
      ...(res.volumesRestored ?? []).map((v) => v.volume),
    ]
    const skipped = [
      ...res.skipped.map((s) => `${s.database} (${s.reason})`),
      ...(res.volumesSkipped ?? []).map((v) => `${v.volume} (${v.reason})`),
    ]

    if (restored.length === 0) {
      // A reset that restored nothing is a failure to communicate, not a success.
      toast.error(
        skipped.length
          ? `Nothing reset — ${skipped.join('; ')}`
          : 'Nothing to reset — nothing here has a baseline yet',
      )
      return
    }
    if (skipped.length) {
      toast.warning(`Restoring ${restored.join(', ')}. Skipped ${skipped.join(', ')}`)
    } else {
      toast.success(`Restoring ${restored.join(', ')} to baseline`)
    }
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not reset the environment'))
  }
}
</script>

<template>
  <AlertDialog v-if="canReset && hasTargets">
    <AlertDialogTrigger as-child>
      <Button variant="outline" size="sm" :disabled="busy">
        <LoaderCircle v-if="busy" class="animate-spin" />
        <RotateCcw v-else />
        Reset data
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Reset this environment's data?</AlertDialogTitle>
        <AlertDialogDescription>
          Every database and volume here is restored to its baseline. Anything
          written since — test accounts, uploads, order history — is discarded.
          Anything without a baseline is left untouched, and reported back.
          <template v-if="(volumeBaselineCount ?? 0) > 0">
            Restoring a volume restarts whatever is using it, so the app is
            briefly unavailable.
          </template>
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction :disabled="busy" @click="onReset">
          <LoaderCircle v-if="busy" class="animate-spin" />
          Reset to baseline
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>

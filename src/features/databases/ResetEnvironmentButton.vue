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

const props = defineProps<{ envId: string; databaseCount: number }>()

const reset = useResetEnvironment(() => props.envId)
// Client gating is cosmetic; the API enforces snapshots.restore.
const canReset = useCan('env.manage')
const busy = computed(() => reset.isPending.value)

async function onReset() {
  try {
    const res = await reset.mutateAsync()
    if (res.restored.length === 0) {
      // A reset that restored nothing is a failure to communicate, not a success.
      toast.error(
        res.skipped.length
          ? `Nothing reset — ${res.skipped.map((s) => `${s.database}: ${s.reason}`).join('; ')}`
          : 'Nothing to reset — this environment has no databases',
      )
      return
    }
    const names = res.restored.map((r) => r.database).join(', ')
    if (res.skipped.length) {
      toast.warning(
        `Restoring ${names}. Skipped ${res.skipped.map((s) => `${s.database} (${s.reason})`).join(', ')}`,
      )
    } else {
      toast.success(`Restoring ${names} to baseline`)
    }
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not reset the environment'))
  }
}
</script>

<template>
  <AlertDialog v-if="canReset && databaseCount > 0">
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
          Every database here is restored to its baseline snapshot. Anything
          written since — test accounts, uploads, order history — is discarded.
          Databases without a baseline are left untouched.
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

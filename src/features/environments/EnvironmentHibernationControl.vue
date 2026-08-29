<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle, Moon, Sun } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useHibernateEnvironment,
  useUpdateHibernation,
  useWakeEnvironment,
} from './environments.queries'
import {
  SLEEPING_URL_NOTE,
  hibernationDetail,
  hibernationErrorMessage,
  hibernationStatus,
  hibernationStatusLabel,
  timeoutLabel,
  timeoutOptions,
} from './environments.hibernation'
import { useCan } from '@/features/orgs/useCan'
import { useNowMs } from '@/lib/clock'
import type { EnvironmentHibernation } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
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
  hibernation?: EnvironmentHibernation | null
}>()

const now = useNowMs()
const canManage = useCan('env.manage')

const status = computed(() => hibernationStatus(props.hibernation, now.value))
const asleep = computed(() => status.value.kind === 'asleep')
const statusLabel = computed(() => hibernationStatusLabel(status.value))
const detail = computed(() => hibernationDetail(status.value))

const save = useUpdateHibernation()
const wake = useWakeEnvironment()
const sleep = useHibernateEnvironment()
const busy = computed(
  () => save.isPending.value || wake.isPending.value || sleep.isPending.value,
)

const showSettings = ref(false)
const draftEnabled = ref(false)
const draftTimeout = ref('240')

const options = computed(() => timeoutOptions(props.hibernation?.idleTimeoutMinutes ?? 240))

// Opened, not mounted: the dialog holds a draft, and reopening it after a
// cancel must show what is stored rather than what was abandoned.
watch(showSettings, (open) => {
  if (!open) return
  draftEnabled.value = props.hibernation?.enabled ?? false
  draftTimeout.value = String(props.hibernation?.idleTimeoutMinutes ?? 240)
})

const target = computed(() => ({ envId: props.envId, projectId: props.projectId }))

async function onSave() {
  try {
    const next = await save.mutateAsync({
      ...target.value,
      input: { enabled: draftEnabled.value, idleTimeoutMinutes: Number(draftTimeout.value) },
    })
    showSettings.value = false
    toast.success(
      next.enabled
        ? `Sleeps after ${timeoutLabel(next.idleTimeoutMinutes)} with nothing hitting its URL`
        : 'Hibernation off — this environment stays up',
    )
  } catch (e) {
    toast.error(hibernationErrorMessage(e, 'Could not save the hibernation settings'))
  }
}

async function onWake() {
  try {
    const { services } = await wake.mutateAsync(target.value)
    toast.success(`Woken — ${services.length} service${services.length === 1 ? '' : 's'} started`, {
      description: 'The URL answers again once the containers finish booting.',
    })
  } catch (e) {
    toast.error(hibernationErrorMessage(e, 'Could not wake the environment'))
  }
}

async function onSleepNow() {
  try {
    await sleep.mutateAsync(target.value)
    showSettings.value = false
    toast.success('Asleep — its containers are stopped', { description: SLEEPING_URL_NOTE })
  } catch (e) {
    toast.error(hibernationErrorMessage(e, 'Could not sleep the environment'))
  }
}
</script>

<template>
  <div class="flex items-center gap-3">
    <template v-if="asleep">
      <span
        class="inline-flex items-center gap-1.5 rounded-full bg-signal-idle/15 px-2.5 py-0.5 text-xs font-medium text-ink-2"
      >
        <Moon class="size-3.5" />
        {{ statusLabel }}
      </span>
      <!-- Not decoration: the URL 404s while this holds, and a 404 is
           indistinguishable from a deleted environment. -->
      <span class="hidden text-xs text-ink-4 sm:inline">{{ SLEEPING_URL_NOTE }}</span>

      <Button v-if="canManage" size="sm" variant="outline" :disabled="busy" @click="onWake">
        <LoaderCircle v-if="wake.isPending.value" class="animate-spin" />
        <Sun v-else />
        Wake
      </Button>
    </template>

    <Button
      v-else-if="canManage"
      size="sm"
      variant="ghost"
      class="text-ink-3"
      :title="detail"
      :disabled="busy"
      @click="showSettings = true"
    >
      <Moon />
      {{ statusLabel }}
    </Button>

    <span v-else-if="status.kind === 'armed'" class="text-xs text-ink-4" :title="detail">
      {{ statusLabel }}
    </span>
  </div>

  <Dialog v-model:open="showSettings">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Hibernation</DialogTitle>
        <DialogDescription>
          Stops this environment's containers once nothing has used it for a while, and starts them
          again on a click or the next deploy. While it is asleep its URL returns 404 — the route is
          removed with the containers rather than left serving an error.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <label class="flex items-start gap-3">
          <Checkbox
            id="hibernation-enabled"
            class="mt-0.5"
            :model-value="draftEnabled"
            @update:model-value="(v) => (draftEnabled = v === true)"
          />
          <span class="grid gap-1">
            <span class="text-sm text-ink-1">Sleep this environment when it goes idle</span>
            <span class="text-xs text-muted-foreground">
              Idle means nothing has reached its URL. Traffic between its own services does not
              count, and a held lock keeps it awake.
            </span>
          </span>
        </label>

        <div class="grid gap-2">
          <Label for="hibernation-timeout">Idle timeout</Label>
          <Select id="hibernation-timeout" v-model="draftTimeout" :disabled="!draftEnabled">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in options" :key="m" :value="String(m)">
                {{ timeoutLabel(m) }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">{{ detail }}</p>
        </div>
      </div>

      <DialogFooter class="sm:justify-between">
        <Button
          v-if="!asleep"
          type="button"
          variant="ghost"
          class="text-ink-3"
          :disabled="busy"
          @click="onSleepNow"
        >
          <LoaderCircle v-if="sleep.isPending.value" class="animate-spin" />
          <Moon v-else />
          Sleep now
        </Button>
        <span v-else />

        <span class="flex gap-2">
          <Button variant="outline" type="button" :disabled="busy" @click="showSettings = false">
            Cancel
          </Button>
          <Button type="button" :disabled="busy" @click="onSave">
            <LoaderCircle v-if="save.isPending.value" class="animate-spin" />
            Save
          </Button>
        </span>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

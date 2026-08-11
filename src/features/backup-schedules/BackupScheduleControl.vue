<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { CalendarClock, LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useBackupSchedules,
  useDeleteBackupSchedule,
  useSaveBackupSchedule,
} from './schedules.queries'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import { relativeTime } from '@/lib/time'
import type { BackupTargetKind } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  envId: string
  kind: BackupTargetKind
  databaseId?: string
  volumeName?: string
}>()

// Presets rather than a cron field: the API accepts any expression, but a
// backup cadence is one of a handful of choices and a free-text cron is a
// support burden for the 5% who want something else.
const CADENCES = [
  { value: '0 * * * *', label: 'Every hour' },
  { value: '0 3 * * *', label: 'Daily at 03:00' },
  { value: '0 3 * * 0', label: 'Weekly (Sun 03:00)' },
  { value: '0 3 1 * *', label: 'Monthly (1st, 03:00)' },
]
const OFF = 'off'

const { data: schedules } = useBackupSchedules(() => props.envId)
const save = useSaveBackupSchedule(() => props.envId)
const remove = useDeleteBackupSchedule(() => props.envId)
const canManage = useCan('env.manage')

const existing = computed(() =>
  (schedules.value ?? []).find((s) =>
    props.kind === 'DATABASE'
      ? s.databaseId === props.databaseId
      : s.volumeName === props.volumeName,
  ),
)

const cadence = ref(OFF)
const keepLast = ref(7)

watch(
  existing,
  (s) => {
    cadence.value = s && s.enabled ? s.schedule : OFF
    keepLast.value = s?.keepLast ?? 7
  },
  { immediate: true },
)

const dirty = computed(() => {
  const s = existing.value
  const current = s && s.enabled ? s.schedule : OFF
  return cadence.value !== current || keepLast.value !== (s?.keepLast ?? 7)
})

const busy = computed(() => save.isPending.value || remove.isPending.value)

// A cadence the presets don't cover (set through the API) must not be silently
// rewritten by this control, so it is shown as-is and left alone.
const isCustom = computed(
  () =>
    Boolean(existing.value) &&
    existing.value!.enabled &&
    !CADENCES.some((c) => c.value === existing.value!.schedule),
)

async function apply() {
  try {
    if (cadence.value === OFF) {
      if (existing.value) await remove.mutateAsync(existing.value.id)
      toast.success('Automatic backups turned off')
      return
    }
    await save.mutateAsync({
      id: existing.value?.id,
      input: {
        kind: props.kind,
        databaseId: props.databaseId,
        volumeName: props.volumeName,
        schedule: cadence.value,
        keepLast: keepLast.value,
        enabled: true,
      },
    })
    toast.success('Automatic backups scheduled')
  } catch (err) {
    toast.error(apiErrorMessage(err))
  }
}
</script>

<template>
  <div
    class="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border px-4 py-3"
  >
    <CalendarClock class="size-4 shrink-0 text-muted-foreground" />
    <span class="text-sm text-foreground">Automatic backups</span>

    <Select v-model="cadence" :disabled="!canManage || busy || isCustom">
      <SelectTrigger class="h-8 w-[190px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem :value="OFF">Off</SelectItem>
        <SelectItem v-for="c in CADENCES" :key="c.value" :value="c.value">
          {{ c.label }}
        </SelectItem>
      </SelectContent>
    </Select>

    <label v-if="cadence !== OFF" class="flex items-center gap-2 text-sm text-muted-foreground">
      keep
      <Input
        v-model.number="keepLast"
        type="number"
        min="0"
        max="365"
        class="h-8 w-16"
        :disabled="!canManage || busy"
      />
    </label>

    <Button v-if="dirty" size="sm" :disabled="!canManage || busy" @click="apply">
      <LoaderCircle v-if="busy" class="animate-spin" />
      Save
    </Button>

    <p class="w-full text-xs text-muted-foreground/70">
      <template v-if="isCustom">
        Custom schedule <span class="font-mono">{{ existing!.schedule }}</span> — edit it through
        the API.
      </template>
      <template v-else-if="existing && existing.enabled">
        Keeps the {{ existing.keepLast }} most recent automatic backups; ones you took yourself are
        never removed.
        <template v-if="existing.nextRunAt">
          Next run {{ relativeTime(existing.nextRunAt) }}.</template
        >
        <template v-if="existing.lastRunAt">
          Last run {{ relativeTime(existing.lastRunAt) }}.</template
        >
      </template>
      <template v-else>
        No automatic backups — this target is only backed up when you ask.
      </template>
    </p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { browserTimezone, CRON_PRESETS, describeCron } from './cron'
import { useCreateScheduledTask, useUpdateScheduledTask } from './scheduled-tasks.queries'
import { apiErrorMessage } from '@/lib/api'
import type { ScheduledTask } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  task?: ScheduledTask | null
  services: string[]
}>()
const open = defineModel<boolean>('open', { required: true })

const create = useCreateScheduledTask(() => props.envId)
const update = useUpdateScheduledTask(() => props.envId)
const saving = computed(() => create.isPending.value || update.isPending.value)
const editing = computed(() => !!props.task)

const name = ref('')
const service = ref('')
const command = ref('')
const schedule = ref('0 3 * * *')
const timezone = ref('UTC')

watch(open, (isOpen) => {
  if (!isOpen) return
  const t = props.task
  name.value = t?.name ?? ''
  service.value = t?.service ?? props.services[0] ?? 'web'
  command.value = t?.command ?? ''
  schedule.value = t?.schedule ?? '0 3 * * *'
  timezone.value = t?.timezone ?? browserTimezone()
})

const summary = computed(() => describeCron(schedule.value))

async function onSubmit() {
  const input = {
    name: name.value.trim(),
    service: service.value.trim(),
    command: command.value.trim(),
    schedule: schedule.value.trim(),
    timezone: timezone.value.trim() || 'UTC',
  }
  if (!input.name || !input.command || !input.service) return

  try {
    if (props.task) {
      await update.mutateAsync({ id: props.task.id, input })
      toast.success('Task updated')
    } else {
      await create.mutateAsync(input)
      toast.success('Task scheduled')
    }
    open.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save the task'))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ editing ? 'Edit task' : 'New scheduled task' }}</DialogTitle>
        <DialogDescription>
          One command, run in a service container on a schedule. For several steps, commit a script
          and run that.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <Label for="task-name">Name</Label>
          <Input id="task-name" v-model="name" placeholder="Nightly backup" />
        </div>

        <div class="grid gap-1.5">
          <Label for="task-service">Service</Label>
          <Select v-model="service">
            <SelectTrigger id="task-service">
              <SelectValue placeholder="Pick a service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="s in services" :key="s" :value="s">{{ s }}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="grid gap-1.5">
          <Label for="task-command">Command</Label>
          <Input
            id="task-command"
            v-model="command"
            class="font-mono text-xs"
            placeholder="sh scripts/nightly.sh"
          />
          <p class="text-xs text-ink-4">
            Runs from the repo root. Name the interpreter explicitly — alpine images ship
            <code class="font-mono">sh</code>, not <code class="font-mono">bash</code>.
          </p>
        </div>

        <div class="grid gap-1.5">
          <Label for="task-schedule">Schedule</Label>
          <div class="flex gap-2">
            <Select
              :model-value="CRON_PRESETS.some((p) => p.value === schedule) ? schedule : ''"
              @update:model-value="(v) => (schedule = String(v))"
            >
              <SelectTrigger id="task-schedule" class="w-52">
                <SelectValue placeholder="Custom" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="p in CRON_PRESETS" :key="p.value" :value="p.value">
                  {{ p.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-model="schedule"
              class="flex-1 font-mono text-xs"
              aria-label="Cron expression"
            />
          </div>
          <p class="text-xs text-ink-4">{{ summary }} · {{ timezone }}</p>
        </div>

        <div class="grid gap-1.5">
          <Label for="task-tz">Timezone</Label>
          <Input id="task-tz" v-model="timezone" class="font-mono text-xs" placeholder="UTC" />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button :disabled="saving || !name.trim() || !command.trim()" @click="onSubmit">
          <LoaderCircle v-if="saving" class="animate-spin" />
          {{ editing ? 'Save' : 'Create task' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

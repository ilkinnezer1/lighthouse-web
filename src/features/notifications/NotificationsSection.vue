<script setup lang="ts">
import { ref } from 'vue'
import { Bell, LoaderCircle, Plus, Send, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useCreateNotificationChannel,
  useDeleteNotificationChannel,
  useNotificationChannels,
  useTestNotificationChannel,
  useUpdateNotificationChannel,
} from './notifications.queries'
import { apiErrorMessage } from '@/lib/api'
import type { NotificationKind } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ orgId: string }>()

const KINDS: { value: NotificationKind; label: string }[] = [
  { value: 'SLACK', label: 'Slack' },
  { value: 'DISCORD', label: 'Discord' },
  { value: 'WEBHOOK', label: 'Webhook' },
]

const EVENT_LABEL: Record<string, string> = {
  'deploy.succeeded': 'Deploy succeeded',
  'deploy.failed': 'Deploy failed',
  'deploy.cancelled': 'Deploy cancelled',
  'database.provision_failed': 'Database provisioning failed',
  'database.snapshot_failed': 'Snapshot failed',
}

const { data, isPending, isError } = useNotificationChannels(() => props.orgId)
const create = useCreateNotificationChannel(() => props.orgId)
const update = useUpdateNotificationChannel(() => props.orgId)
const remove = useDeleteNotificationChannel(() => props.orgId)
const test = useTestNotificationChannel(() => props.orgId)

const adding = ref(false)
const newName = ref('')
const newKind = ref<NotificationKind>('SLACK')
const newUrl = ref('')
const testing = ref<string | null>(null)

function resetForm() {
  adding.value = false
  newName.value = ''
  newKind.value = 'SLACK'
  newUrl.value = ''
}

async function onCreate() {
  try {
    await create.mutateAsync({
      name: newName.value.trim(),
      kind: newKind.value,
      url: newUrl.value.trim(),
    })
    toast.success('Channel added')
    resetForm()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not add channel'))
  }
}

async function onToggle(id: string, enabled: boolean) {
  try {
    await update.mutateAsync({ id, input: { enabled } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not update channel'))
  }
}

async function onToggleEvent(id: string, current: string[], event: string, on: boolean) {
  // An empty list means "everything", so the first opt-out has to materialise
  // the full set minus the one being switched off.
  const all = data.value?.events ?? []
  const base = current.length === 0 ? all : current
  const next = on ? [...new Set([...base, event])] : base.filter((e) => e !== event)
  try {
    await update.mutateAsync({ id, input: { events: next } })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not update events'))
  }
}

async function onTest(id: string) {
  testing.value = id
  try {
    const result = await test.mutateAsync(id)
    if (result.ok) toast.success('Test message sent')
    else toast.error(`Test failed: ${result.error ?? 'unknown error'}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not send test'))
  } finally {
    testing.value = null
  }
}

async function onDelete(id: string) {
  try {
    await remove.mutateAsync(id)
    toast.success('Channel removed')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not remove channel'))
  }
}

function wants(channel: { events: string[] }, event: string): boolean {
  return channel.events.length === 0 || channel.events.includes(event)
}
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-sm font-semibold tracking-tight text-foreground">
        Notifications
        <span v-if="data?.channels.length" class="ml-1 text-muted-foreground/60">
          {{ data.channels.length }}
        </span>
      </h2>
      <Button v-if="!adding" size="sm" variant="outline" @click="adding = true">
        <Plus />
        Add channel
      </Button>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      Posts to Slack, Discord or any webhook when a deploy in this organization finishes. The URL is
      stored encrypted and never shown again.
    </p>

    <div v-if="adding" class="mt-3 grid gap-3 rounded-xl border border-border bg-card p-4">
      <div class="grid gap-2">
        <Label for="ch-name">Name</Label>
        <Input id="ch-name" v-model="newName" placeholder="#deploys" />
      </div>
      <div class="grid gap-2">
        <Label>Type</Label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="k in KINDS"
            :key="k.value"
            type="button"
            :class="[
              'rounded-lg border px-3 py-2 text-sm transition-colors',
              newKind === k.value
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-border text-muted-foreground hover:border-muted-foreground/40',
            ]"
            @click="newKind = k.value"
          >
            {{ k.label }}
          </button>
        </div>
      </div>
      <div class="grid gap-2">
        <Label for="ch-url">Webhook URL</Label>
        <Input
          id="ch-url"
          v-model="newUrl"
          placeholder="https://hooks.slack.com/services/..."
          class="font-mono text-xs"
        />
      </div>
      <div class="flex justify-end gap-2">
        <Button size="sm" variant="ghost" @click="resetForm">Cancel</Button>
        <Button
          size="sm"
          :disabled="!newName.trim() || !newUrl.trim() || create.isPending.value"
          @click="onCreate"
        >
          <LoaderCircle v-if="create.isPending.value" class="animate-spin" />
          Add channel
        </Button>
      </div>
    </div>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-16 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load channels.</p>

    <div
      v-else-if="!data || data.channels.length === 0"
      class="mt-3 rounded-xl border border-dashed border-border py-10 text-center"
    >
      <Bell class="mx-auto size-5 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">No channels yet.</p>
    </div>

    <div v-else class="mt-3 space-y-3">
      <div
        v-for="c in data.channels"
        :key="c.id"
        class="rounded-xl border border-border bg-card p-4"
      >
        <div class="flex items-center gap-3">
          <span class="truncate text-sm font-medium text-foreground">{{ c.name }}</span>
          <span
            class="rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {{ c.kind.toLowerCase() }}
          </span>
          <label class="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              :model-value="c.enabled"
              @update:model-value="(v) => onToggle(c.id, v === true)"
            />
            Enabled
          </label>
          <Button
            size="icon-sm"
            variant="ghost"
            class="text-muted-foreground"
            title="Send a test message"
            :disabled="testing === c.id"
            @click="onTest(c.id)"
          >
            <LoaderCircle v-if="testing === c.id" class="animate-spin" />
            <Send v-else />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            class="text-muted-foreground hover:text-destructive"
            title="Remove channel"
            @click="onDelete(c.id)"
          >
            <Trash2 />
          </Button>
        </div>

        <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          <label
            v-for="ev in data.events"
            :key="ev"
            class="flex items-center gap-2 text-xs text-muted-foreground"
          >
            <Checkbox
              :model-value="wants(c, ev)"
              @update:model-value="(v) => onToggleEvent(c.id, c.events, ev, v === true)"
            />
            {{ EVENT_LABEL[ev] ?? ev }}
          </label>
        </div>
      </div>
    </div>
  </section>
</template>

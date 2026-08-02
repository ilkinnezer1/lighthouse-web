<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, Pencil, Play, Plus, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { describeCron } from './cron'
import ScheduledTaskDialog from './ScheduledTaskDialog.vue'
import {
  useDeleteScheduledTask,
  useRunScheduledTask,
  useScheduledTasks,
  useTaskRuns,
} from './scheduled-tasks.queries'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import { durationLabel, relativeTime } from '@/lib/time'
import type { ScheduledTask, TaskRunStatus } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  SectionHead,
  SignalDot,
} from '@/components/ui/section'
import type { StatusTone } from '@/features/deployments/deployments.status'

const props = defineProps<{ envId: string; services: string[] }>()

const { data: tasks, isPending, isError, error, refetch } = useScheduledTasks(() => props.envId)
const removeTask = useDeleteScheduledTask(() => props.envId)
const runTask = useRunScheduledTask(() => props.envId)
const canManage = useCan('env.manage')

const dialogOpen = ref(false)
const editing = ref<ScheduledTask | null>(null)
const expanded = ref<string | null>(null)

const runsQuery = useTaskRuns(
  () => expanded.value ?? '',
  { enabled: () => !!expanded.value },
)

const runTone: Record<TaskRunStatus, StatusTone> = {
  RUNNING: 'active',
  SUCCEEDED: 'success',
  FAILED: 'error',
  SKIPPED: 'neutral',
}

function lastRunOf(t: ScheduledTask) {
  return t.runs?.[0] ?? null
}

const busyId = ref<string | null>(null)

async function onRun(t: ScheduledTask) {
  busyId.value = t.id
  try {
    const res = await runTask.mutateAsync(t.id)
    if (res.status === 'SUCCEEDED') toast.success(`${t.name} succeeded`)
    else if (res.status === 'SKIPPED') toast.info(`${t.name} skipped — already running`)
    else toast.error(`${t.name} failed${res.exitCode != null ? ` (exit ${res.exitCode})` : ''}`)
    if (expanded.value === t.id) runsQuery.refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not run the task'))
  } finally {
    busyId.value = null
  }
}

async function onDelete(t: ScheduledTask) {
  try {
    await removeTask.mutateAsync(t.id)
    toast.success(`${t.name} deleted`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not delete the task'))
  }
}

function openNew() {
  editing.value = null
  dialogOpen.value = true
}
function openEdit(t: ScheduledTask) {
  editing.value = t
  dialogOpen.value = true
}
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}

const count = computed(() => tasks.value?.length ?? 0)
</script>

<template>
  <section>
    <SectionHead eyebrow="Scheduled tasks" :count="count">
      <template #actions>
        <Button v-if="canManage" size="sm" variant="outline" @click="openNew">
          <Plus />
          New task
        </Button>
      </template>
    </SectionHead>

    <LoadingRows v-if="isPending" :rows="2" />

    <ErrorState
      v-else-if="isError"
      :message="apiErrorMessage(error, 'Could not load scheduled tasks.')"
      @retry="() => refetch()"
    />

    <EmptyState
      v-else-if="count === 0"
      title="Nothing scheduled"
      deck="Run a command on a cron — backups, cache warming, or a script from your repo."
    >
      <template #action>
        <Button v-if="canManage" size="sm" variant="outline" @click="openNew">
          <Plus />
          New task
        </Button>
      </template>
    </EmptyState>

    <div v-else class="rule-y">
      <div v-for="t in tasks" :key="t.id">
        <div class="flex items-center gap-3 py-3">
          <SignalDot
            v-if="lastRunOf(t)"
            :tone="runTone[lastRunOf(t)!.status]"
            :title="`Last run ${lastRunOf(t)!.status.toLowerCase()}`"
          />
          <span v-else class="size-2 shrink-0 rounded-full border border-rule" title="Never run" />

          <button
            type="button"
            class="flex min-w-0 flex-1 items-center gap-3 text-left"
            :aria-expanded="expanded === t.id"
            @click="toggle(t.id)"
          >
            <span class="min-w-0 shrink-0 basis-44">
              <span class="block truncate text-sm" :class="t.enabled ? 'text-ink-1' : 'text-ink-4'">
                {{ t.name }}
                <span v-if="!t.enabled" class="text-ink-4">· paused</span>
              </span>
              <span class="mt-0.5 block truncate text-xs text-ink-4">
                {{ describeCron(t.schedule) }}
              </span>
            </span>

            <code class="min-w-0 flex-1 truncate font-mono text-xs text-ink-3">
              {{ t.service }}: {{ t.command }}
            </code>

            <span class="hidden shrink-0 basis-32 text-right text-xs text-ink-4 sm:block">
              <template v-if="t.enabled && t.nextRunAt">
                next {{ relativeTime(t.nextRunAt) }}
              </template>
              <template v-else>—</template>
            </span>

            <ChevronDown
              class="size-4 shrink-0 text-ink-4 transition-transform"
              :class="expanded === t.id && 'rotate-180'"
            />
          </button>

          <div class="flex shrink-0 items-center gap-0.5">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Run now"
              aria-label="Run now"
              :disabled="busyId === t.id"
              @click="onRun(t)"
            >
              <Play :class="busyId === t.id && 'animate-pulse'" />
            </Button>
            <Button
              v-if="canManage"
              variant="ghost"
              size="icon-sm"
              title="Edit"
              aria-label="Edit task"
              @click="openEdit(t)"
            >
              <Pencil />
            </Button>
            <Button
              v-if="canManage"
              variant="ghost"
              size="icon-sm"
              class="text-destructive hover:text-destructive"
              title="Delete"
              aria-label="Delete task"
              @click="onDelete(t)"
            >
              <Trash2 />
            </Button>
          </div>
        </div>

        <!-- run history -->
        <div v-if="expanded === t.id" class="pb-4 pl-5">
          <p v-if="runsQuery.isPending.value" class="text-xs text-ink-4">Loading runs…</p>
          <p v-else-if="!runsQuery.data.value?.length" class="text-xs text-ink-4">
            No runs yet.
          </p>
          <div v-else class="rule-y border-l border-rule pl-4">
            <div v-for="r in runsQuery.data.value" :key="r.id" class="py-2">
              <div class="flex items-baseline gap-3 text-xs">
                <SignalDot :tone="runTone[r.status]" size="sm" class="translate-y-[3px]" />
                <span class="shrink-0 basis-28 font-mono text-ink-3">
                  {{ relativeTime(r.startedAt) }}
                </span>
                <span class="shrink-0 basis-16 text-ink-4">
                  {{ durationLabel(r.startedAt, r.finishedAt) ?? '—' }}
                </span>
                <span class="shrink-0 basis-16 font-mono text-ink-4">
                  {{ r.trigger === 'MANUAL' ? 'manual' : 'cron' }}
                </span>
                <span class="min-w-0 flex-1 truncate" :class="r.status === 'FAILED' ? 'text-signal-error' : 'text-ink-3'">
                  {{ r.errorSummary ?? (r.exitCode != null ? `exit ${r.exitCode}` : r.status.toLowerCase()) }}
                </span>
              </div>
              <pre
                v-if="r.output"
                class="log-pane mt-2 max-h-40 overflow-auto rounded-md p-3 font-mono text-[11px] leading-relaxed"
              >{{ r.output }}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ScheduledTaskDialog
      v-model:open="dialogOpen"
      :env-id="envId"
      :task="editing"
      :services="services"
    />
  </section>
</template>

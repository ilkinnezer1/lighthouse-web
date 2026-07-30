<script setup lang="ts">
import { computed, ref } from 'vue'
import { Play } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { describeCron } from './cron'
import { useAllScheduledTasks, useRunScheduledTask } from './scheduled-tasks.queries'
import { useProjects } from '@/features/projects/projects.queries'
import { useSelectFilter } from '@/lib/feed'
import { apiErrorMessage } from '@/lib/api'
import { relativeTime } from '@/lib/time'
import type { ScheduledTaskListItem, TaskRunStatus } from '@/types/api'
import type { StatusTone } from '@/features/deployments/deployments.status'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
  SignalDot,
} from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const [projectFilter, projectId] = useSelectFilter<string>()
const stateFilter = ref<'all' | 'enabled' | 'paused'>('all')
const enabled = computed(() =>
  stateFilter.value === 'all' ? undefined : stateFilter.value === 'enabled',
)

const { data: projects } = useProjects()
const { data: tasks, isPending, isError, error, refetch } = useAllScheduledTasks({
  projectId,
  enabled,
})
// Run-now invalidates by environment, so pass the one the row belongs to.
const runTask = useRunScheduledTask(() => '')

const runTone: Record<TaskRunStatus, StatusTone> = {
  RUNNING: 'active',
  SUCCEEDED: 'success',
  FAILED: 'error',
  SKIPPED: 'neutral',
}

const filtered = computed(
  () => projectFilter.value !== 'all' || stateFilter.value !== 'all',
)
function clearFilters() {
  projectFilter.value = 'all'
  stateFilter.value = 'all'
}

const busyId = ref<string | null>(null)
async function onRun(t: ScheduledTaskListItem) {
  busyId.value = t.id
  try {
    const res = await runTask.mutateAsync(t.id)
    if (res.status === 'SUCCEEDED') toast.success(`${t.name} succeeded`)
    else if (res.status === 'SKIPPED') toast.info(`${t.name} skipped — already running`)
    else toast.error(`${t.name} failed${res.exitCode != null ? ` (exit ${res.exitCode})` : ''}`)
    refetch()
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not run the task'))
  } finally {
    busyId.value = null
  }
}

const count = computed(() => tasks.value?.length ?? 0)
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Scheduled tasks"
      deck="Every recurring command across your projects."
    >
      <template #actions>
        <Select v-model="projectFilter">
          <SelectTrigger class="h-8 w-40 text-xs" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem v-for="p in projects ?? []" :key="p.id" :value="p.id">
              {{ p.name }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="stateFilter">
          <SelectTrigger class="h-8 w-32 text-xs" aria-label="Filter by state">
            <SelectValue placeholder="All states" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All states</SelectItem>
            <SelectItem value="enabled">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHead>

    <div class="mt-12">
      <LoadingRows v-if="isPending" :rows="5" />

      <ErrorState
        v-else-if="isError"
        :message="apiErrorMessage(error, 'Could not load scheduled tasks.')"
        @retry="() => refetch()"
      />

      <EmptyState
        v-else-if="count === 0 && filtered"
        title="Nothing matches those filters"
        deck="Widen the search to see the tasks you do have."
      >
        <template #action>
          <Button variant="outline" size="sm" @click="clearFilters">Clear filters</Button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="count === 0"
        title="No scheduled tasks"
        deck="Open an environment to add one — backups, cache warming, or a script from your repo."
      />

      <div v-else>
        <SectionHead eyebrow="All tasks" :count="count" />
        <div class="rule-y">
          <div v-for="t in tasks" :key="t.id" class="flex items-center gap-4 py-4">
            <SignalDot
              v-if="t.runs?.[0]"
              :tone="runTone[t.runs[0].status]"
              :title="`Last run ${t.runs[0].status.toLowerCase()}`"
            />
            <span v-else class="size-2 shrink-0 rounded-full border border-rule" title="Never run" />

            <RouterLink
              :to="`/projects/${t.environment.project.id}/env/${t.environment.id}`"
              class="flex min-w-0 flex-1 items-center gap-4"
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

              <span class="min-w-0 shrink-0 basis-48 truncate text-xs text-ink-3">
                {{ t.environment.project.name }}<span class="text-ink-4">/{{ t.environment.name }}</span>
              </span>

              <code class="min-w-0 flex-1 truncate font-mono text-xs text-ink-4">
                {{ t.service }}: {{ t.command }}
              </code>

              <span class="hidden shrink-0 basis-32 text-right text-xs text-ink-4 sm:block">
                <template v-if="t.enabled && t.nextRunAt">
                  next {{ relativeTime(t.nextRunAt) }}
                </template>
                <template v-else>—</template>
              </span>
            </RouterLink>

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
          </div>
        </div>
      </div>
    </div>
  </PageShell>
</template>

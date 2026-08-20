<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ExternalLink, RotateCcw } from '@lucide/vue'
import { useEnvironmentsFeed } from './environments.queries'
import EnvironmentLockBadge from './EnvironmentLockBadge.vue'
import FindingsFlag from '@/features/findings/FindingsFlag.vue'
import {
  environmentBranch,
  environmentTicket,
  environmentTicketHref,
  sourceBranch,
} from './environments.board'
import { statusTone, titleCase } from '@/features/deployments/deployments.status'
import { useProjects } from '@/features/projects/projects.queries'
import { useAuthStore } from '@/features/auth/auth.store'
import { useSelectFilter } from '@/lib/feed'
import { relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'
import { apiErrorMessage } from '@/lib/api'
import type { EnvironmentListItem, EnvironmentType } from '@/types/api'
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

const router = useRouter()
const auth = useAuthStore()

const [projectFilter, projectId] = useSelectFilter<string>()
const [typeFilter, type] = useSelectFilter<EnvironmentType>()
const [liveFilter, liveValue] = useSelectFilter<'live' | 'idle'>()

const { data: projects } = useProjects()

const active = computed(() =>
  liveValue.value === undefined ? undefined : liveValue.value === 'live',
)
const feed = useEnvironmentsFeed({ projectId, type, active })
const items = feed.items

const typeOptions: EnvironmentType[] = ['PRODUCTION', 'PREVIEW', 'MANUAL']

const filtered = computed(
  () => projectFilter.value !== 'all' || typeFilter.value !== 'all' || liveFilter.value !== 'all',
)
function clearFilters() {
  projectFilter.value = 'all'
  typeFilter.value = 'all'
  liveFilter.value = 'all'
}

// The board's whole point: the ticket on this sandbox. See environments.board.
const ticket = environmentTicket
const ticketHref = environmentTicketHref
const branchName = environmentBranch

function goToEnvironment(e: EnvironmentListItem) {
  void router.push(`/projects/${e.project.id}/env/${e.id}`)
}
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Environments"
      deck="What is deployed where, across every project."
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
        <Select v-model="typeFilter">
          <SelectTrigger class="h-8 w-32 text-xs" aria-label="Filter by type">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem v-for="t in typeOptions" :key="t" :value="t">
              {{ titleCase(t) }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select v-model="liveFilter">
          <SelectTrigger class="h-8 w-28 text-xs" aria-label="Filter by state">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="idle">Torn down</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHead>

    <div class="mt-12">
      <LoadingRows v-if="feed.isPending.value" :rows="6" />

      <ErrorState
        v-else-if="feed.isError.value"
        :message="apiErrorMessage(feed.error.value, 'Could not load environments.')"
        :retrying="feed.isFetching.value"
        @retry="() => feed.refetch()"
      />

      <EmptyState
        v-else-if="items.length === 0 && filtered"
        title="Nothing matches those filters"
        deck="Widen the search to see the environments you do have."
      >
        <template #action>
          <Button variant="outline" size="sm" @click="clearFilters">Clear filters</Button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="items.length === 0"
        title="No environments yet"
        deck="Create a project and its environments will show up here with whatever is deployed on them."
      />

      <div v-else>
        <SectionHead eyebrow="All environments" :count="items.length" />
        <div class="rule-y">
          <div
            v-for="e in items"
            :key="e.id"
            class="group flex items-center gap-4 py-4 transition-colors hover:bg-accent/40"
          >
            <button
              type="button"
              class="flex min-w-0 flex-1 items-center gap-4 text-left focus-visible:outline-none"
              @click="goToEnvironment(e)"
            >
              <SignalDot
                :tone="e.latestDeployment ? statusTone[e.latestDeployment.status] : 'neutral'"
                :title="
                  e.latestDeployment ? titleCase(e.latestDeployment.status) : 'Never deployed'
                "
              />

              <span class="w-56 min-w-0 shrink-0">
                <span class="block truncate text-sm text-ink-1">{{ e.project.name }}</span>
                <span class="mt-0.5 block truncate font-mono text-xs text-ink-4">
                  {{ e.name }}
                </span>
              </span>

              <!-- The answer to "what is on this sandbox" — the ticket if the
                   branch names one, otherwise the branch itself. -->
              <span class="min-w-0 flex-1">
                <span v-if="ticket(e)" class="block truncate text-sm text-ink-2">
                  {{ ticket(e) }}
                </span>
                <span v-else class="block truncate font-mono text-sm text-ink-2">
                  {{ branchName(e) }}
                </span>
                <span v-if="ticket(e)" class="mt-0.5 block truncate font-mono text-xs text-ink-4">
                  {{ branchName(e) }}
                </span>
              </span>

              <!-- Who is on it, next to what is on it. Reserved like the
                   columns below, so an unlocked row does not shift the rest. -->
              <span class="hidden w-36 shrink-0 md:block">
                <EnvironmentLockBadge :lock="e.lock" :current-user-id="auth.user?.id" />
              </span>

              <!-- The row's third answer, next to what is on it and who is on
                   it: whether anything is wrong with it. -->
              <span class="hidden w-20 shrink-0 md:block">
                <FindingsFlag :count="e.openFindingCount" />
              </span>

              <!-- Reserved even when empty: a column that appears only on some
                   rows leaves every following column ragged. -->
              <span class="hidden w-16 shrink-0 text-right font-mono text-xs text-ink-4 lg:block">
                {{ e.latestDeployment?.commitSha ? shortSha(e.latestDeployment.commitSha) : '' }}
              </span>

              <span class="w-24 shrink-0 text-right text-xs text-ink-4">
                {{
                  e.latestDeployment ? relativeTime(e.latestDeployment.createdAt) : 'never deployed'
                }}
              </span>
            </button>

            <!-- Kept outside the row button: nesting an anchor inside a button
                 is invalid, and both need to stay independently clickable. -->
            <span class="flex shrink-0 items-center gap-1">
              <span class="hidden w-20 shrink-0 text-right sm:block">
                <a
                  v-if="ticketHref(e)"
                  :href="ticketHref(e)!"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="rounded font-mono text-xs text-ink-4 transition-colors hover:text-primary"
                  :title="`Open ${sourceBranch(e)?.issueKey} in Jira`"
                >
                  {{ sourceBranch(e)?.issueKey }}
                </a>
              </span>
              <a
                :href="e.url"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded p-1 text-ink-4 transition-colors hover:text-primary"
                :title="`Open ${e.url}`"
              >
                <ExternalLink class="size-4" />
              </a>
            </span>
          </div>
        </div>

        <div v-if="feed.hasNextPage.value" class="mt-8 flex justify-center">
          <Button
            variant="ghost"
            size="sm"
            :disabled="feed.isFetchingNextPage.value"
            @click="() => feed.fetchNextPage()"
          >
            <RotateCcw v-if="feed.isFetchingNextPage.value" class="animate-spin" />
            {{ feed.isFetchingNextPage.value ? 'Loading…' : 'Load more' }}
          </Button>
        </div>
      </div>
    </div>
  </PageShell>
</template>

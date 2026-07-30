<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw } from '@lucide/vue'
import { useAuditFeed } from './audit.queries'
import AuditRow from './AuditRow.vue'
import { useSelectFilter } from '@/lib/feed'
import { dayLabel } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { AuditRow as AuditRowT } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
} from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const actionInput = ref('')
const action = computed(() => actionInput.value.trim() || undefined)
const [resourceTypeFilter, resourceType] = useSelectFilter<string>()
const fromInput = ref('')
const toInput = ref('')

// `datetime-local` yields a zoneless value; widen to a full ISO instant for the API.
const from = computed(() => (fromInput.value ? new Date(fromInput.value).toISOString() : undefined))
const to = computed(() => (toInput.value ? new Date(toInput.value).toISOString() : undefined))

const feed = useAuditFeed({ action, resourceType, from, to })
const items = feed.items

const groups = computed(() => {
  const out: { label: string; items: AuditRowT[] }[] = []
  for (const r of items.value) {
    const label = dayLabel(r.createdAt)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(r)
    else out.push({ label, items: [r] })
  }
  return out
})

const resourceTypeOptions = ['projects', 'deployments', 'databases', 'environments']

function resetFilters() {
  actionInput.value = ''
  resourceTypeFilter.value = 'all'
  fromInput.value = ''
  toInput.value = ''
}

const hasFilters = computed(() => !!(action.value || resourceType.value || from.value || to.value))
</script>

<template>
  <PageShell>
    <PageHead eyebrow="Audit" title="Activity" deck="Audit trail of every action, newest first." />

    <!-- Filters are labelled rather than placeholder-only; a placeholder
         disappears the moment you type, taking its meaning with it. -->
    <section class="mt-8 flex flex-wrap items-end gap-x-3 gap-y-4">
      <div class="grid gap-1.5">
        <Label for="audit-action" class="eyebrow">Action</Label>
        <Input
          id="audit-action"
          v-model="actionInput"
          placeholder="projects.create"
          class="h-8 w-56 font-mono text-xs"
        />
      </div>

      <div class="grid gap-1.5">
        <Label for="audit-resource" class="eyebrow">Resource</Label>
        <Select v-model="resourceTypeFilter">
          <SelectTrigger id="audit-resource" class="h-8 w-40 text-xs">
            <SelectValue placeholder="All resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All resources</SelectItem>
            <SelectItem v-for="t in resourceTypeOptions" :key="t" :value="t">{{ t }}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div class="grid gap-1.5">
        <Label for="audit-from" class="eyebrow">From</Label>
        <Input id="audit-from" v-model="fromInput" type="datetime-local" class="h-8 w-48 text-xs" />
      </div>

      <div class="grid gap-1.5">
        <Label for="audit-to" class="eyebrow">To</Label>
        <Input id="audit-to" v-model="toInput" type="datetime-local" class="h-8 w-48 text-xs" />
      </div>

      <Button v-if="hasFilters" variant="ghost" size="sm" class="h-8" @click="resetFilters">
        Clear filters
      </Button>
    </section>

    <div class="mt-10">
      <LoadingRows v-if="feed.isPending.value" :rows="10" :dot="false" />

      <ErrorState
        v-else-if="feed.isError.value"
        :message="apiErrorMessage(feed.error.value, 'Could not load the audit log.')"
        :retrying="feed.isFetching.value"
        @retry="() => feed.refetch()"
      />

      <EmptyState
        v-else-if="items.length === 0 && hasFilters"
        title="Nothing in that range"
        deck="No recorded action matches these filters."
      >
        <template #action>
          <Button variant="outline" size="sm" @click="resetFilters">Clear filters</Button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="items.length === 0"
        title="No activity yet"
        deck="Actions you take will show up here as they happen."
      />

      <div v-else>
        <section v-for="group in groups" :key="group.label" class="mb-10 last:mb-0">
          <div
            class="sticky top-0 z-10 flex items-baseline gap-2.5 border-b border-rule bg-background/90 pb-2 backdrop-blur"
          >
            <h2 class="eyebrow">{{ group.label }}</h2>
            <span class="font-mono text-xs text-ink-4">{{ group.items.length }}</span>
          </div>

          <div class="rule-y">
            <AuditRow v-for="r in group.items" :key="r.id" :row="r" />
          </div>
        </section>

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

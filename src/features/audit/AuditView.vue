<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw, ScrollText } from '@lucide/vue'
import { useAuditFeed } from './audit.queries'
import AuditRow from './AuditRow.vue'
import { useSelectFilter } from '@/lib/feed'
import { dayLabel } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { AuditRow as AuditRowT } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
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

const hasFilters = computed(
  () => !!(action.value || resourceType.value || from.value || to.value),
)
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Activity</h1>
        <p class="mt-1 text-sm text-muted-foreground">
          Audit trail of every action, newest first.
        </p>
      </div>
    </header>

    <div class="mt-6 flex flex-wrap items-end gap-2">
      <Input
        v-model="actionInput"
        placeholder="Filter action (e.g. projects.create)"
        class="h-9 w-60 font-mono text-xs"
      />
      <Select v-model="resourceTypeFilter">
        <SelectTrigger class="h-9 w-44">
          <SelectValue placeholder="All resources" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All resources</SelectItem>
          <SelectItem v-for="t in resourceTypeOptions" :key="t" :value="t">{{ t }}</SelectItem>
        </SelectContent>
      </Select>
      <Input v-model="fromInput" type="datetime-local" class="h-9 w-52" aria-label="From" />
      <Input v-model="toInput" type="datetime-local" class="h-9 w-52" aria-label="To" />
      <Button v-if="hasFilters" variant="ghost" size="sm" class="h-9" @click="resetFilters">
        Clear
      </Button>
    </div>

    <div v-if="feed.isPending.value" class="mt-8 overflow-hidden rounded-xl border border-border">
      <div
        v-for="n in 8"
        :key="n"
        class="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
      >
        <Skeleton class="size-3.5" />
        <Skeleton class="h-3 w-12" />
        <Skeleton class="h-4 w-28" />
        <Skeleton class="h-3 flex-1" />
      </div>
    </div>

    <div
      v-else-if="feed.isError.value"
      class="mt-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(feed.error.value) }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => feed.refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <div
      v-else-if="items.length === 0"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <ScrollText class="size-6 text-primary" />
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No activity yet</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        {{
          hasFilters
            ? 'Nothing matches these filters — try widening the range.'
            : 'Actions you take will show up here as they happen.'
        }}
      </p>
    </div>

    <div v-else class="mt-8">
      <section v-for="group in groups" :key="group.label" class="mb-6 last:mb-0">
        <div
          class="sticky top-0 z-10 flex items-center gap-2 bg-background/80 py-1.5 backdrop-blur"
        >
          <h2 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {{ group.label }}
          </h2>
          <span class="text-xs text-muted-foreground/60">{{ group.items.length }}</span>
        </div>

        <div class="overflow-hidden rounded-xl border border-border">
          <AuditRow v-for="r in group.items" :key="r.id" :row="r" />
        </div>
      </section>

      <div v-if="feed.hasNextPage.value" class="mt-2 flex justify-center">
        <Button
          variant="outline"
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
</template>

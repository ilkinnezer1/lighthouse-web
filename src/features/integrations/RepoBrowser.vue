<script setup lang="ts">
import { computed, ref } from 'vue'
import { refDebounced } from '@vueuse/core'
import { ExternalLink, Lock, RotateCcw, Search } from '@lucide/vue'
import { useRepoBrowser } from './integrations.queries'
import { repoBrowseBlockedNote } from './integrations.credentials'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { RepoSummary } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

// `canBrowse` is "some credential can reach GitHub", not "OAuth is connected" —
// the server falls back to a saved token, so the two are no longer the same.
const props = defineProps<{ canBrowse: boolean; oauthUnconfigured?: boolean }>()
const emit = defineEmits<{ deploy: [repo: RepoSummary] }>()

const searchInput = ref('')
const search = refDebounced(searchInput, 300)

const browser = useRepoBrowser({ search, enabled: () => props.canBrowse })
const items = browser.items

const blockedNote = computed(() => repoBrowseBlockedNote(!!props.oauthUnconfigured))
</script>

<template>
  <section>
    <div class="flex items-end justify-between gap-4">
      <div>
        <h2 class="text-sm font-medium text-foreground">Repositories</h2>
        <p class="mt-0.5 text-xs text-muted-foreground">
          Pick a repository to deploy it with Lighthouse.
        </p>
      </div>
      <div class="relative w-64">
        <Search
          class="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/60"
        />
        <Input
          v-model="searchInput"
          :disabled="!props.canBrowse"
          placeholder="Search repositories"
          class="h-9 pl-8 text-sm"
        />
      </div>
    </div>

    <!-- nothing that can reach GitHub -->
    <div
      v-if="!props.canBrowse || browser.notConnected.value"
      class="mt-4 rounded-xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground"
    >
      <span class="mx-auto block max-w-prose">{{ blockedNote }}</span>
    </div>

    <!-- loading (first page) -->
    <div
      v-else-if="browser.isPending.value"
      class="mt-4 overflow-hidden rounded-xl border border-border"
    >
      <div
        v-for="n in 6"
        :key="n"
        class="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
      >
        <Skeleton class="h-4 w-40" />
        <Skeleton class="h-3 w-24" />
        <Skeleton class="ml-auto h-8 w-20" />
      </div>
    </div>

    <!-- error (non-428) -->
    <div
      v-else-if="browser.isError.value"
      class="mt-4 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-12 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(browser.error.value) }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => browser.refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <!-- empty -->
    <div
      v-else-if="items.length === 0"
      class="mt-4 rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground"
    >
      {{
        searchInput
          ? 'No repositories match that search.'
          : 'No repositories found for this account.'
      }}
    </div>

    <!-- list -->
    <div v-else class="mt-4 overflow-hidden rounded-xl border border-border">
      <div
        v-for="repo in items"
        :key="repo.fullName"
        class="group flex items-center gap-3 border-b border-border bg-card px-4 py-3 transition-colors last:border-b-0 hover:bg-accent/40"
      >
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-2">
            <span class="truncate font-mono text-sm text-foreground">{{ repo.name }}</span>
            <Badge v-if="repo.private" variant="outline" class="gap-1 text-[11px]">
              <Lock class="size-3" />
              Private
            </Badge>
            <a
              :href="repo.htmlUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              :aria-label="`Open ${repo.fullName} on GitHub`"
            >
              <ExternalLink class="size-3.5" />
            </a>
          </div>
          <p v-if="repo.description" class="mt-0.5 truncate text-xs text-muted-foreground">
            {{ repo.description }}
          </p>
          <div class="mt-1 flex items-center gap-3 text-xs text-muted-foreground/70">
            <span class="font-mono">{{ repo.owner }}</span>
            <span v-if="repo.language" class="inline-flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-primary/70" aria-hidden />
              {{ repo.language }}
            </span>
            <span aria-hidden>·</span>
            <span>updated {{ relativeTime(repo.pushedAt) }}</span>
          </div>
        </div>

        <Button variant="outline" size="sm" class="shrink-0" @click="emit('deploy', repo)">
          Deploy
        </Button>
      </div>
    </div>

    <div v-if="browser.hasNextPage.value" class="mt-3 flex justify-center">
      <Button
        variant="outline"
        size="sm"
        :disabled="browser.isFetchingNextPage.value"
        @click="() => browser.fetchNextPage()"
      >
        <RotateCcw v-if="browser.isFetchingNextPage.value" class="animate-spin" />
        {{ browser.isFetchingNextPage.value ? 'Loading…' : 'Load more' }}
      </Button>
    </div>
  </section>
</template>

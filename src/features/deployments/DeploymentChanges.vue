<script setup lang="ts">
import { computed } from 'vue'
import { GitCommitHorizontal } from '@lucide/vue'
import { useDeploymentChanges } from './deployments.queries'
import { changesHeadline, changesHidden } from './deploymentChanges'
import { relativeTime } from '@/lib/time'
import { shortSha } from '@/lib/utils'

const props = defineProps<{ deploymentId: string; hasCommit: boolean }>()

// Nothing to compare until the build has resolved a commit.
const query = useDeploymentChanges(() => props.deploymentId, { enabled: () => props.hasCommit })

const data = computed(() => query.data.value ?? null)
const commits = computed(() => data.value?.commits ?? [])

const hidden = computed(() => !props.hasCommit || changesHidden(data.value))
const headline = computed(() => (data.value ? changesHeadline(data.value) : ''))
</script>

<template>
  <section v-if="!hidden && (query.isPending.value || data)" class="mt-6">
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Changes</h2>

    <p v-if="query.isPending.value" class="mt-3 text-sm text-muted-foreground">
      Working out what changed…
    </p>

    <template v-else-if="data">
      <p class="mt-1 text-xs text-muted-foreground">
        {{ headline }}
        <span v-if="data.previous">
          · since
          <span class="font-mono">{{ shortSha(data.previous.commitSha) }}</span>
          {{ relativeTime(data.previous.createdAt) }}
        </span>
      </p>

      <div v-if="commits.length" class="mt-3 overflow-hidden rounded-xl border border-border">
        <div
          v-for="c in commits"
          :key="c.sha"
          class="flex items-center gap-3 border-b border-border bg-card px-4 py-2.5 last:border-b-0"
        >
          <GitCommitHorizontal class="size-4 shrink-0 text-muted-foreground" />

          <a
            :href="c.url"
            target="_blank"
            rel="noopener noreferrer"
            class="w-16 shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-primary"
            :title="c.sha"
          >
            {{ shortSha(c.sha) }}
          </a>

          <span class="min-w-0 flex-1 truncate text-sm text-foreground" :title="c.message">
            {{ c.message }}
          </span>

          <a
            v-if="c.issueUrl"
            :href="c.issueUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-primary sm:block"
            :title="c.issueTitle ?? undefined"
          >
            {{ c.issueKey }}
          </a>

          <span
            class="hidden w-28 shrink-0 truncate text-right text-xs text-muted-foreground md:block"
          >
            {{ c.author ?? '—' }}
          </span>

          <span class="w-20 shrink-0 text-right text-xs text-muted-foreground">
            {{ c.date ? relativeTime(c.date) : '—' }}
          </span>
        </div>
      </div>

      <!-- GitHub's compare stops at 250; saying so beats showing a short list
           as though it were the whole range. -->
      <p v-if="data.truncated" class="mt-2 text-xs text-muted-foreground">
        Showing the first {{ commits.length }} of {{ data.totalCommits }}.
      </p>
    </template>
  </section>
</template>

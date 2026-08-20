<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import { GitCommitHorizontal } from '@lucide/vue'
import { fixRange, fixRangeIsExact, fixRangeNote } from './findings.staleness'
import FindingLogSnapshot from './FindingLogSnapshot.vue'
import { useDeploymentChanges } from '@/features/deployments/deployments.queries'
import { shortSha } from '@/lib/utils'
import type { Finding } from '@/types/api'

const props = defineProps<{ finding: Finding }>()

const range = computed(() => fixRange(props.finding))
const rangeNote = computed(() => fixRangeNote(range.value))

// The fix build's changes-since-last-deploy range is what fixed this, but only
// when it starts at the build the finding was found on. Asked for lazily —
// this panel is open, so someone is reading it.
const changes = useDeploymentChanges(() => props.finding.fixedIn?.id ?? '', {
  enabled: () => range.value?.kind === 'range',
})

const fixCommits = computed(() =>
  fixRangeIsExact(changes.data.value ?? null, props.finding)
    ? (changes.data.value?.commits ?? [])
    : [],
)
const shown = computed(() => fixCommits.value.slice(0, 6))
const hidden = computed(() =>
  Math.max(0, (changes.data.value?.totalCommits ?? 0) - shown.value.length),
)
</script>

<template>
  <div class="space-y-4">
    <p v-if="finding.body" class="whitespace-pre-wrap text-sm leading-relaxed text-ink-2">
      {{ finding.body }}
    </p>

    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-3">
      <!-- A build with no commit of its own (a prebuilt-image deploy) has no
           sha to name, and inventing one would be worse than saying so. -->
      <RouterLink
        :to="`/deployments/${finding.foundOn.id}`"
        class="transition-colors hover:text-primary"
      >
        <template v-if="shortSha(finding.foundOn.commitSha)">
          Found on <span class="font-mono">{{ shortSha(finding.foundOn.commitSha) }}</span>
        </template>
        <template v-else>The build it was found on</template>
      </RouterLink>

      <RouterLink
        v-if="finding.fixedIn"
        :to="`/deployments/${finding.fixedIn.id}`"
        class="transition-colors hover:text-primary"
      >
        <template v-if="shortSha(finding.fixedIn.commitSha)">
          Fixed in <span class="font-mono">{{ shortSha(finding.fixedIn.commitSha) }}</span>
        </template>
        <template v-else>The build that fixed it</template>
      </RouterLink>

      <span v-if="rangeNote && range?.kind === 'same-build'">{{ rangeNote }}</span>
    </div>

    <div v-if="shown.length">
      <h4 class="text-xs font-medium text-ink-2">
        What landed between them
        <span class="ml-1 font-mono text-ink-4">{{ rangeNote }}</span>
      </h4>
      <div class="mt-1.5 rule-y">
        <div v-for="c in shown" :key="c.sha" class="flex items-center gap-2.5 py-1.5">
          <GitCommitHorizontal class="size-3.5 shrink-0 text-ink-4" aria-hidden="true" />
          <a
            :href="c.url"
            target="_blank"
            rel="noopener noreferrer"
            class="w-14 shrink-0 font-mono text-xs text-ink-4 transition-colors hover:text-primary"
            :title="c.sha"
          >
            {{ shortSha(c.sha) }}
          </a>
          <span class="min-w-0 flex-1 truncate text-xs text-ink-2" :title="c.message">
            {{ c.message }}
          </span>
          <a
            v-if="c.issueUrl"
            :href="c.issueUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="hidden shrink-0 font-mono text-xs text-ink-4 transition-colors hover:text-primary sm:block"
          >
            {{ c.issueKey }}
          </a>
        </div>
      </div>
      <p v-if="hidden" class="mt-1.5 text-xs text-ink-4">and {{ hidden }} more</p>
    </div>

    <FindingLogSnapshot :finding-id="finding.id" :status="finding.logSnapshotStatus" />
  </div>
</template>

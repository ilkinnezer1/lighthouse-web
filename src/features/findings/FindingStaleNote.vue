<script setup lang="ts">
import { computed } from 'vue'
import { History } from '@lucide/vue'
import { stalenessNote, type FindingFreshness } from './findings.staleness'
import { shortSha } from '@/lib/utils'

const props = defineProps<{ freshness: FindingFreshness }>()

const note = computed(() => stalenessNote(props.freshness))
const foundSha = computed(() =>
  'foundSha' in props.freshness ? shortSha(props.freshness.foundSha) : null,
)
const currentSha = computed(() =>
  props.freshness.kind === 'superseded' ? shortSha(props.freshness.currentSha) : null,
)
</script>

<template>
  <!--
    Said out loud rather than implied: a finding sitting next to a build it was
    not seen on reads as having been seen on it, which is untrue.
  -->
  <p
    v-if="freshness.kind !== 'current'"
    class="mt-1 flex items-start gap-1.5 text-xs text-ink-3"
    :title="note ?? undefined"
  >
    <History class="mt-0.5 size-3 shrink-0 text-ink-4" aria-hidden="true" />
    <span>
      <template v-if="foundSha">
        Found on <span class="font-mono text-ink-2">{{ foundSha }}</span>
      </template>
      <template v-else>Found on an earlier build</template>

      <template v-if="freshness.kind === 'rebuilt'">
        — redeployed since at the same commit
      </template>
      <template v-else-if="freshness.kind === 'nothing-deployed'">
        — nothing is deployed on this environment now
      </template>
      <template v-else-if="currentSha">
        — this environment is now on <span class="font-mono text-ink-2">{{ currentSha }}</span>
      </template>
      <template v-else>— this environment has deployed again since</template>
    </span>
  </p>
</template>

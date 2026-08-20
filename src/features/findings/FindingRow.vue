<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { Check, ChevronDown, CircleSlash, RotateCcw } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  filedLine,
  findingDotClass,
  findingStatusLabel,
  findingTextClass,
  resolutionLine,
} from './findings.format'
import { findingFreshness, needsStalenessNote, type BuildRef } from './findings.staleness'
import { useUpdateFinding } from './findings.queries'
import FindingStaleNote from './FindingStaleNote.vue'
import FindingEvidence from './FindingEvidence.vue'
import { apiErrorMessage } from '@/lib/api'
import { shortAgo } from '@/lib/time'
import { shortSha } from '@/lib/utils'
import type { Finding, FindingStatus } from '@/types/api'
import { Button } from '@/components/ui/button'

const props = defineProps<{
  finding: Finding
  // Undefined means "don't ask" — on the deployment page every finding is on
  // the build in front of you. Null is a real answer: nothing is deployed.
  current?: BuildRef | null
  canResolve?: boolean
  // Arrived here from a notification about this one finding.
  focused?: boolean
}>()

const expanded = ref(!!props.focused)

const root = useTemplateRef<HTMLElement>('root')
onMounted(() => {
  if (props.focused) root.value?.scrollIntoView({ block: 'center' })
})

const freshness = computed(() =>
  props.current === undefined || !needsStalenessNote(props.finding)
    ? null
    : findingFreshness(props.finding.foundOn, props.current),
)

const filed = computed(() => filedLine(props.finding, shortAgo(props.finding.createdAt)))
const resolution = computed(() =>
  resolutionLine(props.finding, props.finding.resolvedAt ? shortAgo(props.finding.resolvedAt) : ''),
)

const update = useUpdateFinding()

async function setStatus(status: FindingStatus) {
  try {
    const updated = await update.mutateAsync({ id: props.finding.id, status })
    if (status === 'OPEN') toast.success('Finding reopened')
    else if (status === 'CANNOT_REPRODUCE') toast.success("Marked can't reproduce")
    else {
      const sha = shortSha(updated.fixedIn?.commitSha)
      toast.success(sha ? `Marked fixed on ${sha}` : 'Marked fixed')
    }
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not update the finding'))
  }
}
</script>

<template>
  <div
    ref="root"
    class="relative py-3 before:absolute before:inset-y-1 before:-left-3 before:w-0.5 before:transition-colors"
    :class="focused ? 'before:bg-primary' : 'before:bg-transparent'"
  >
    <button
      type="button"
      class="flex w-full items-start gap-3 text-left"
      :aria-expanded="expanded"
      @click="expanded = !expanded"
    >
      <span
        class="mt-1.5 size-2 shrink-0 rounded-full"
        :class="findingDotClass[finding.status]"
        :title="findingStatusLabel[finding.status]"
      />

      <span class="min-w-0 flex-1">
        <span class="block text-sm text-ink-1">{{ finding.title }}</span>
        <span class="mt-0.5 block truncate text-xs text-ink-4">{{ filed }}</span>

        <FindingStaleNote v-if="freshness" :freshness="freshness" />

        <span v-if="resolution" class="mt-1 block text-xs text-ink-3">{{ resolution }}</span>
      </span>

      <span
        class="hidden shrink-0 text-xs font-medium sm:block"
        :class="findingTextClass[finding.status]"
      >
        {{ findingStatusLabel[finding.status] }}
      </span>

      <ChevronDown
        class="mt-0.5 size-3.5 shrink-0 text-ink-4 transition-transform"
        :class="expanded && 'rotate-180'"
        aria-hidden="true"
      />
    </button>

    <div v-if="expanded" class="mt-3 pl-5">
      <FindingEvidence :finding="finding" />

      <div v-if="canResolve" class="mt-4 flex flex-wrap gap-2">
        <template v-if="finding.status === 'OPEN'">
          <!-- No build picker: the server pins the fix to whatever this
               environment has succeeded on, which is the honest answer. -->
          <Button
            variant="outline"
            size="sm"
            :disabled="update.isPending.value"
            @click="setStatus('FIXED')"
          >
            <Check />
            Mark fixed
          </Button>
          <Button
            variant="ghost"
            size="sm"
            :disabled="update.isPending.value"
            @click="setStatus('CANNOT_REPRODUCE')"
          >
            <CircleSlash />
            Can't reproduce
          </Button>
        </template>
        <Button
          v-else
          variant="ghost"
          size="sm"
          :disabled="update.isPending.value"
          @click="setStatus('OPEN')"
        >
          <RotateCcw />
          Reopen
        </Button>
      </div>
    </div>
  </div>
</template>

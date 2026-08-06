<script setup lang="ts">
import { computed, ref } from 'vue'
import { Database as DatabaseIcon, ExternalLink } from '@lucide/vue'
import DeployTemplateDialog from './DeployTemplateDialog.vue'
import { useTemplates } from './templates.queries'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import type { TemplateSummary } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
} from '@/components/ui/section'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const { data: templates, isPending, isError, error, refetch } = useTemplates()
// Deploying a template creates a project — same gate the server enforces.
const canDeploy = useCan('project.create')

const categoryFilter = ref<string>('all')
const term = ref('')

const categories = computed(() => {
  const seen = new Set((templates.value ?? []).map((t) => t.category))
  return [...seen].sort()
})

const visible = computed(() => {
  const q = term.value.trim().toLowerCase()
  return (templates.value ?? []).filter((t) => {
    if (categoryFilter.value !== 'all' && t.category !== categoryFilter.value) return false
    if (!q) return true
    return `${t.name} ${t.description} ${t.category}`.toLowerCase().includes(q)
  })
})

const filtered = computed(() => categoryFilter.value !== 'all' || !!term.value.trim())
function clearFilters() {
  categoryFilter.value = 'all'
  term.value = ''
}

const chosen = ref<TemplateSummary | null>(null)
const dialogOpen = ref(false)
function onDeploy(template: TemplateSummary) {
  chosen.value = template
  dialogOpen.value = true
}
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Templates"
      deck="Ready-made apps that deploy from a published image — no repository, no build."
    >
      <template #actions>
        <input
          v-model="term"
          type="search"
          placeholder="Search templates"
          aria-label="Search templates"
          class="h-8 w-44 rounded-md border border-rule bg-transparent px-2.5 text-xs outline-none placeholder:text-ink-4 focus:border-ink-4"
        />
        <Select v-model="categoryFilter">
          <SelectTrigger class="h-8 w-36 text-xs" aria-label="Filter by category">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            <SelectItem v-for="c in categories" :key="c" :value="c">{{ c }}</SelectItem>
          </SelectContent>
        </Select>
      </template>
    </PageHead>

    <div class="mt-12">
      <LoadingRows v-if="isPending" :rows="6" />

      <ErrorState
        v-else-if="isError"
        :message="apiErrorMessage(error, 'Could not load the template catalog.')"
        @retry="() => refetch()"
      />

      <EmptyState
        v-else-if="visible.length === 0 && filtered"
        title="Nothing matches that"
        deck="Try a different word, or clear the category filter."
      >
        <template #action>
          <Button variant="outline" size="sm" @click="clearFilters">Clear filters</Button>
        </template>
      </EmptyState>

      <EmptyState
        v-else-if="visible.length === 0"
        title="No templates available"
        deck="The catalog ships with the API — this build has none."
      />

      <div v-else>
        <SectionHead eyebrow="Catalog" :count="visible.length" />
        <div class="rule-y">
          <article
            v-for="t in visible"
            :key="t.slug"
            class="flex flex-wrap items-baseline gap-x-4 gap-y-2 py-5"
          >
            <div class="min-w-0 flex-1 basis-64">
              <h3 class="flex items-center gap-2 text-sm text-ink-1">
                {{ t.name }}
                <a
                  v-if="t.website"
                  :href="t.website"
                  target="_blank"
                  rel="noreferrer noopener"
                  class="text-ink-4 transition-colors hover:text-ink-2"
                  :aria-label="`${t.name} website`"
                  @click.stop
                >
                  <ExternalLink class="size-3" />
                </a>
              </h3>
              <p class="mt-1 max-w-prose text-sm text-ink-3">{{ t.description }}</p>
              <p class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-4">
                <span class="eyebrow">{{ t.category }}</span>
                <code class="font-mono">{{ t.image }}</code>
                <span v-if="t.volumeCount > 0" class="flex items-center gap-1">
                  <DatabaseIcon class="size-3" />
                  {{ t.volumeCount }} {{ t.volumeCount === 1 ? 'volume' : 'volumes' }}
                </span>
                <span v-else>stateless</span>
              </p>
            </div>

            <Button
              variant="outline"
              size="sm"
              :disabled="!canDeploy"
              :title="canDeploy ? undefined : 'You need project-create access in this organization'"
              @click="onDeploy(t)"
            >
              Deploy
            </Button>
          </article>
        </div>
      </div>
    </div>

    <DeployTemplateDialog v-model:open="dialogOpen" :template="chosen" />
  </PageShell>
</template>

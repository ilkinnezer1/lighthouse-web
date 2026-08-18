<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import AtlassianCard from './AtlassianCard.vue'
import AtlassianGuide from './AtlassianGuide.vue'
import ConnectionCard from './ConnectionCard.vue'
import IntegrationsGuide from './IntegrationsGuide.vue'
import RepoBrowser from './RepoBrowser.vue'
import { integrationKeys, useConnections } from './integrations.queries'
import CreateProjectDialog from '@/features/projects/CreateProjectDialog.vue'
import { PageHead, PageShell, SectionHead } from '@/components/ui/section'
import type { Project, ProjectPrefill, RepoSummary } from '@/types/api'

const route = useRoute()
const router = useRouter()
const qc = useQueryClient()

const { data, isPending } = useConnections()

const connection = computed(
  () => data.value?.connections.find((c) => c.provider === 'github') ?? null,
)
const atlassianConnection = computed(
  () => data.value?.connections.find((c) => c.provider === 'atlassian') ?? null,
)
const isConnected = computed(() => !!connection.value)

// The live API has no "configured" flag and its connect 503 is a direct server
// response, so the only SPA-visible signal is this callback error code. Captured
// from the query param (which onMounted clears) so the panel persists.
const notConfigured = ref(false)
const atlassianNotConfigured = ref(false)

const dialogOpen = ref(false)
const prefill = ref<ProjectPrefill>()

function onDeploy(repo: RepoSummary) {
  prefill.value = {
    name: repo.name,
    repoUrl: `${repo.htmlUrl}.git`,
    providerRepoFullName: repo.fullName,
    defaultBranch: repo.defaultBranch,
  }
  dialogOpen.value = true
}

function onCreated(project: Project) {
  void router.push(`/projects/${project.id}`)
}

const errorMessages: Record<string, string> = {
  github_connect_failed: 'GitHub connection failed. Please try again.',
  github_not_configured: 'GitHub integration is not configured on this instance.',
  access_denied: 'Authorization was cancelled.',
  atlassian_connect_failed: 'Jira connection failed. Please try again.',
  atlassian_not_configured: 'Jira integration is not configured on this instance.',
}

onMounted(() => {
  const { connected, error } = route.query
  if (connected === 'github' || connected === 'atlassian') {
    toast.success(connected === 'github' ? 'GitHub connected' : 'Jira connected')
    void qc.invalidateQueries({ queryKey: integrationKeys.all })
  } else if (typeof error === 'string') {
    toast.error(errorMessages[error] ?? 'Could not connect.')
    if (error === 'github_not_configured') notConfigured.value = true
    if (error === 'atlassian_not_configured') atlassianNotConfigured.value = true
  }
  if (connected || error) void router.replace({ query: {} })
})
</script>

<template>
  <PageShell>
    <PageHead
      eyebrow="Workspace"
      title="Integrations"
      deck="Connect a Git provider and deploy straight from your repositories."
    />

    <section class="mt-12">
      <SectionHead eyebrow="Providers" />
      <div class="space-y-4 pt-4">
        <ConnectionCard
          :connection="connection"
          :loading="isPending"
          :not-configured="notConfigured"
        />
        <AtlassianCard
          :connection="atlassianConnection"
          :loading="isPending"
          :not-configured="atlassianNotConfigured"
        />
        <IntegrationsGuide />
        <AtlassianGuide />
      </div>
    </section>

    <section class="mt-10">
      <RepoBrowser :connected="isConnected" @deploy="onDeploy" />
    </section>

    <CreateProjectDialog v-model:open="dialogOpen" :prefill="prefill" @created="onCreated" />
  </PageShell>
</template>

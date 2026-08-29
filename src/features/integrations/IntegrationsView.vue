<script setup lang="ts">
import { computed, onMounted, ref, useTemplateRef } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import AtlassianCard from './AtlassianCard.vue'
import AtlassianGuide from './AtlassianGuide.vue'
import ConnectionCard from './ConnectionCard.vue'
import GitCredentialsSection from './GitCredentialsSection.vue'
import IntegrationsGuide from './IntegrationsGuide.vue'
import RepoBrowser from './RepoBrowser.vue'
import { integrationKeys, useIntegrations } from './integrations.queries'
import { showsOauthNotice } from './integrations.credentials'
import CreateProjectDialog from '@/features/projects/CreateProjectDialog.vue'
import { PageHead, PageShell, SectionHead } from '@/components/ui/section'
import type { Project, ProjectPrefill, RepoSummary } from '@/types/api'

const route = useRoute()
const router = useRouter()
const qc = useQueryClient()

const { data, isPending } = useIntegrations()

const connection = computed(
  () => data.value?.connections.find((c) => c.provider === 'github') ?? null,
)
const atlassianConnection = computed(
  () => data.value?.connections.find((c) => c.provider === 'atlassian') ?? null,
)
const isConnected = computed(() => !!connection.value)

const githubConfigured = computed(() => data.value?.providers?.github.configured)
const atlassianConfigured = computed(() => data.value?.providers?.atlassian.configured)

// A failed callback is the other way to learn a provider is unconfigured — on a
// server that predates `providers` it is the only way. Captured from the query
// param (which onMounted clears) so the panel survives the cleanup.
const githubCallbackFailed = ref(false)
const atlassianCallbackFailed = ref(false)

const githubUnconfigured = computed(() =>
  showsOauthNotice({
    configured: githubConfigured.value,
    connected: !!connection.value,
    callbackFailed: githubCallbackFailed.value,
  }),
)
const atlassianUnconfigured = computed(() =>
  showsOauthNotice({
    configured: atlassianConfigured.value,
    connected: !!atlassianConnection.value,
    callbackFailed: atlassianCallbackFailed.value,
  }),
)

const tokens = useTemplateRef<{ focusToken: () => void }>('tokens')

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
    if (error === 'github_not_configured') githubCallbackFailed.value = true
    if (error === 'atlassian_not_configured') atlassianCallbackFailed.value = true
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
          :not-configured="githubUnconfigured"
          @use-token="tokens?.focusToken()"
        />
        <AtlassianCard
          :connection="atlassianConnection"
          :loading="isPending"
          :not-configured="atlassianUnconfigured"
        />
        <IntegrationsGuide />
        <AtlassianGuide />
      </div>
    </section>

    <GitCredentialsSection ref="tokens" class="mt-12" />

    <section class="mt-12">
      <RepoBrowser
        :connected="isConnected"
        :oauth-unconfigured="githubUnconfigured"
        @deploy="onDeploy"
      />
    </section>

    <CreateProjectDialog v-model:open="dialogOpen" :prefill="prefill" @created="onCreated" />
  </PageShell>
</template>

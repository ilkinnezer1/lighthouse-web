<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useQueryClient } from '@tanstack/vue-query'
import { toast } from 'vue-sonner'
import ConnectionCard from './ConnectionCard.vue'
import IntegrationsGuide from './IntegrationsGuide.vue'
import RepoBrowser from './RepoBrowser.vue'
import { integrationKeys, useConnections } from './integrations.queries'

const route = useRoute()
const router = useRouter()
const qc = useQueryClient()

const { data, isPending } = useConnections()

const connection = computed(
  () => data.value?.connections.find((c) => c.provider === 'github') ?? null,
)
const isConnected = computed(() => !!connection.value)

const errorMessages: Record<string, string> = {
  github_connect_failed: 'GitHub connection failed. Please try again.',
  github_not_configured: 'GitHub integration is not configured on this instance.',
  access_denied: 'GitHub authorization was cancelled.',
}

onMounted(() => {
  const { connected, error } = route.query
  if (connected === 'github') {
    toast.success('GitHub connected')
    qc.invalidateQueries({ queryKey: integrationKeys.all })
  } else if (typeof error === 'string') {
    toast.error(errorMessages[error] ?? 'Could not connect GitHub.')
  }
  if (connected || error) router.replace({ query: {} })
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header>
      <h1 class="text-2xl font-semibold tracking-tight text-foreground">Integrations</h1>
      <p class="mt-1 text-sm text-muted-foreground">
        Connect a Git provider and deploy straight from your repositories.
      </p>
    </header>

    <div class="mt-6 space-y-4">
      <ConnectionCard :connection="connection" :loading="isPending" />
      <IntegrationsGuide />
    </div>

    <div class="mt-8">
      <RepoBrowser :connected="isConnected" />
    </div>
  </div>
</template>

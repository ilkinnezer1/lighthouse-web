<script setup lang="ts">
import { computed, nextTick, useTemplateRef } from 'vue'
import { TriangleAlert } from '@lucide/vue'
import AddGitCredentialForm from './AddGitCredentialForm.vue'
import GitCredentialRow from './GitCredentialRow.vue'
import { useGitCredentials } from './integrations.queries'
import { missingRepoScopeCount } from './integrations.credentials'
import { apiErrorMessage } from '@/lib/api'
import { ErrorState, LoadingRows, SectionHead } from '@/components/ui/section'

const { credentials, isPending, isError, error, refetch } = useGitCredentials()

const missing = computed(() => missingRepoScopeCount(credentials.value))

const root = useTemplateRef<HTMLElement>('root')
const form = useTemplateRef<{ focus: () => void }>('form')

async function focusToken() {
  root.value?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await nextTick()
  form.value?.focus()
}

defineExpose({ focusToken })
</script>

<template>
  <section id="git-tokens" ref="root">
    <SectionHead eyebrow="Access tokens" :count="credentials.length">
      <template v-if="missing" #actions>
        <span class="flex items-center gap-1.5 text-xs text-signal-error">
          <TriangleAlert class="size-3.5" />
          {{ missing }} without repo access
        </span>
      </template>
    </SectionHead>

    <p class="mt-3 max-w-prose text-sm text-ink-3">
      A GitHub personal access token lets Lighthouse read and clone your private repositories
      without an OAuth App. It is encrypted on the server and never sent back to the browser.
    </p>

    <LoadingRows v-if="isPending" :rows="2" class="mt-2" />

    <ErrorState
      v-else-if="isError"
      class="mt-4"
      :message="apiErrorMessage(error, 'Could not load your tokens')"
      @retry="() => refetch()"
    />

    <template v-else>
      <div v-if="credentials.length" class="rule-y mt-2">
        <GitCredentialRow v-for="c in credentials" :key="c.id" :credential="c" />
      </div>
      <p v-else class="mt-4 text-sm text-ink-4">
        No tokens saved yet — nothing here is needed for public repositories.
      </p>
    </template>

    <div class="mt-5">
      <AddGitCredentialForm ref="form" />
    </div>
  </section>
</template>

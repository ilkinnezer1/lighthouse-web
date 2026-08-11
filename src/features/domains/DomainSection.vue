<script setup lang="ts">
import { ref, watch } from 'vue'
import { Globe, LoaderCircle, RefreshCw, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { checkDomain } from './domains.api'
import { useClearDomain, useDomain, useSetDomain } from './domains.queries'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import type { DomainCheck } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ envId: string }>()

const { data: status, isPending, isError } = useDomain(() => props.envId)
const save = useSetDomain(() => props.envId)
const clear = useClearDomain(() => props.envId)
const canEdit = useCan('env.manage')

const draft = ref('')
const check = ref<DomainCheck | null>(null)
const checking = ref(false)

// Reflect the stored value, but never clobber something being typed.
watch(
  () => status.value?.customDomain,
  (domain) => {
    if (!save.isPending.value) draft.value = domain ?? ''
    check.value = null
  },
  { immediate: true },
)

async function onSave() {
  const domain = draft.value.trim()
  if (!domain) return
  try {
    await save.mutateAsync(domain)
    check.value = null
    toast.success(`Domain set to ${domain}`, {
      description: 'Redeploy this environment to route traffic to it.',
    })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not set the domain'))
  }
}

async function onClear() {
  try {
    await clear.mutateAsync()
    draft.value = ''
    check.value = null
    toast.success('Custom domain removed', {
      description: 'Redeploy to go back to the generated address.',
    })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not remove the domain'))
  }
}

async function onCheck() {
  checking.value = true
  try {
    check.value = await checkDomain(props.envId)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not check DNS'))
  } finally {
    checking.value = false
  }
}
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Custom domain</h2>
    <p class="mt-1 text-xs text-muted-foreground">
      Serve this environment on your own hostname instead of the generated address. Point the domain
      at this server first, then add it here — Traefik picks it up
      <strong class="font-medium">on the next deploy</strong>, because routing is attached when the
      container is created.
    </p>

    <div v-if="isPending" class="mt-3">
      <Skeleton class="h-12 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">
      Could not load the domain settings.
    </p>

    <div v-else class="mt-3 space-y-3">
      <div class="flex flex-wrap items-center gap-2">
        <Globe class="size-4 shrink-0 text-muted-foreground" />
        <Input
          v-model="draft"
          placeholder="app.example.com"
          class="h-9 min-w-0 flex-1 basis-64 font-mono text-sm"
          :disabled="!canEdit"
          @keyup.enter="onSave"
        />
        <Button
          size="sm"
          :disabled="
            !canEdit ||
            !draft.trim() ||
            draft.trim() === status?.customDomain ||
            save.isPending.value
          "
          @click="onSave"
        >
          <LoaderCircle v-if="save.isPending.value" class="animate-spin" />
          Save
        </Button>
        <Button
          v-if="status?.customDomain"
          size="sm"
          variant="ghost"
          :disabled="!canEdit || clear.isPending.value"
          title="Remove custom domain"
          @click="onClear"
        >
          <LoaderCircle v-if="clear.isPending.value" class="animate-spin" />
          <Trash2 v-else />
        </Button>
      </div>

      <div v-if="status?.customDomain" class="flex flex-wrap items-center gap-3 text-xs">
        <Button size="sm" variant="outline" :disabled="checking" @click="onCheck">
          <RefreshCw :class="checking && 'animate-spin'" />
          Check DNS
        </Button>
        <span v-if="status.target" class="text-muted-foreground">
          Point a CNAME at <code class="font-mono text-foreground">{{ status.target }}</code>
        </span>
        <span v-else class="text-muted-foreground">
          Local mode — no public address to point DNS at.
        </span>
      </div>

      <div
        v-if="check"
        class="rounded-lg border border-border bg-card px-3 py-2.5 text-xs"
        :class="check.matches ? 'text-foreground' : 'text-muted-foreground'"
      >
        <p v-if="check.matches" class="text-foreground">
          ✓ {{ check.domain }} resolves to this server.
        </p>
        <p v-else-if="!check.resolves">
          {{ check.domain }} does not resolve yet. DNS changes can take a while to propagate.
        </p>
        <p v-else>
          {{ check.domain }} resolves to
          <code class="font-mono">{{ check.found.join(', ') }}</code>
          <template v-if="check.expected.length">
            but this server is at <code class="font-mono">{{ check.expected.join(', ') }}</code>
          </template>
          .
        </p>
        <p v-if="check.note" class="mt-1 text-muted-foreground">{{ check.note }}</p>
      </div>
    </div>
  </section>
</template>

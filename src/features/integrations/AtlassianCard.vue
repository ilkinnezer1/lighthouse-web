<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, LoaderCircle, TriangleAlert, Unplug } from '@lucide/vue'
import { toast } from 'vue-sonner'
import JiraMark from './JiraMark.vue'
import { connectAtlassian } from './integrations.api'
import { useDisconnectAtlassian } from './integrations.queries'
import { useActiveOrg } from '@/features/orgs/useActiveOrg'
import { useCan } from '@/features/orgs/useCan'
import { useClearOrgJiraSite, useOrgJira, useSetOrgJiraSite } from '@/features/orgs/orgs.queries'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { AtlassianConnection } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{
  connection?: AtlassianConnection | null
  loading?: boolean
  notConfigured?: boolean
}>()

const { activeOrg } = useActiveOrg()
const orgId = computed(() => activeOrg.value?.id ?? '')
const canManage = useCan('jira.manage')

// Only an admin may read the org's Jira settings, so members never fire it.
const jiraQuery = useOrgJira(orgId, {
  enabled: () => !!orgId.value && !!props.connection && canManage.value,
})

const disconnect = useDisconnectAtlassian()
const setSite = useSetOrgJiraSite(orgId)
const clearSite = useClearOrgJiraSite(orgId)

const NONE = '__none__'
const selected = ref<string>(NONE)

// The picker mirrors the server's answer whenever it changes underneath us
// (first load, another admin switching the site, a fresh connection).
watch(
  () => jiraQuery.data.value?.site?.cloudId,
  (cloudId) => {
    selected.value = cloudId ?? NONE
  },
  { immediate: true },
)

const sites = computed(() => jiraQuery.data.value?.availableSites ?? [])
const busy = computed(() => setSite.isPending.value || clearSite.isPending.value)

async function onSiteChange(value: unknown) {
  const next = typeof value === 'string' ? value : NONE
  const current = jiraQuery.data.value?.site?.cloudId ?? NONE
  if (next === current) return
  try {
    if (next === NONE) {
      await clearSite.mutateAsync()
      toast.success('Jira site cleared')
    } else {
      await setSite.mutateAsync(next)
      toast.success('Jira site updated')
    }
  } catch (error) {
    selected.value = current
    toast.error(apiErrorMessage(error, 'Could not update the Jira site'))
  }
}

async function onDisconnect() {
  try {
    await disconnect.mutateAsync()
    toast.success('Atlassian disconnected')
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not disconnect Atlassian'))
  }
}
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-5">
    <div class="flex items-center gap-3">
      <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
        <JiraMark class="size-5 text-foreground" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-medium text-foreground">Jira</h2>
        <p class="text-xs text-muted-foreground">
          Label branches with the issue they name, instead of the raw ref.
        </p>
      </div>
    </div>

    <div class="mt-4">
      <div v-if="props.loading" class="flex items-center gap-3">
        <Skeleton class="h-4 w-40" />
        <Skeleton class="ml-auto h-9 w-28" />
      </div>

      <div
        v-else-if="props.notConfigured"
        class="flex items-start gap-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-4 py-3"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-primary" />
        <div class="text-sm">
          <p class="font-medium text-foreground">Jira integration not configured</p>
          <p class="mt-0.5 text-muted-foreground">
            This Lighthouse instance has no Atlassian OAuth app set up. Ask an administrator to
            configure the OAuth client and callback URL.
          </p>
        </div>
      </div>

      <div v-else-if="props.connection" class="space-y-3">
        <div
          class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background/40 px-4 py-3"
        >
          <div class="min-w-0">
            <p class="flex items-center gap-2 text-sm">
              <span class="text-muted-foreground">Connected as</span>
              <span class="font-mono font-medium text-foreground">{{
                props.connection.accountEmail || 'your Atlassian account'
              }}</span>
            </p>
            <p class="mt-1 text-xs text-muted-foreground">
              since {{ relativeTime(props.connection.connectedAt) }}
            </p>
          </div>

          <div class="flex flex-wrap items-center gap-1.5">
            <Badge
              v-for="scope in props.connection.scopes"
              :key="scope"
              variant="secondary"
              class="font-mono text-[11px]"
            >
              {{ scope }}
            </Badge>
          </div>

          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button
                variant="outline"
                size="sm"
                class="ml-auto text-destructive hover:text-destructive"
              >
                <Unplug />
                Disconnect
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Disconnect Atlassian?</AlertDialogTitle>
                <AlertDialogDescription>
                  Branches will go back to showing their raw names. Issue labels already recorded on
                  past deployments are kept.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  class="bg-destructive text-white hover:bg-destructive/90"
                  :disabled="disconnect.isPending.value"
                  @click="onDisconnect"
                >
                  <LoaderCircle v-if="disconnect.isPending.value" class="animate-spin" />
                  Disconnect
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        <div
          v-if="canManage"
          class="flex flex-wrap items-center gap-3 rounded-lg border border-dashed border-border px-4 py-3"
        >
          <span class="text-sm text-foreground">Jira site for {{ activeOrg?.name }}</span>
          <Select v-model="selected" :disabled="busy" @update:model-value="onSiteChange">
            <SelectTrigger class="h-8 w-[260px]">
              <SelectValue placeholder="Choose a site…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="NONE">No site — show plain branch names</SelectItem>
              <SelectItem v-for="s in sites" :key="s.cloudId" :value="s.cloudId">
                {{ s.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <LoaderCircle v-if="busy" class="size-4 animate-spin text-muted-foreground" />
          <Check v-else-if="jiraQuery.data.value?.site" class="size-4 text-primary" />
          <p v-if="sites.length === 0" class="w-full text-xs text-muted-foreground">
            Your Atlassian account can't reach any Jira sites. Check the app's scopes, or that you
            have access to a site.
          </p>
          <p v-else class="w-full text-xs text-muted-foreground">
            Everyone in this organization resolves branch labels against this site, each using their
            own Atlassian account.
          </p>
        </div>
      </div>

      <div v-else class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted-foreground">
          Connect Atlassian to show <span class="font-mono">PROJ-12: Add login</span> instead of
          <span class="font-mono">feature/PROJ-12-add-login</span>.
        </p>
        <Button @click="connectAtlassian()">
          <JiraMark class="size-4" />
          Connect Jira
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { KeyRound, LoaderCircle, Unplug } from '@lucide/vue'
import { toast } from 'vue-sonner'
import GithubMark from './GithubMark.vue'
import { connectGithub } from './integrations.api'
import { useDisconnectGithub } from './integrations.queries'
import { OAUTH_UNCONFIGURED_NOTE, OAUTH_UNCONFIGURED_TITLE } from './integrations.credentials'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { GithubConnection } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
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
  connection?: GithubConnection | null
  loading?: boolean
  // A connect click can only end at a 503 rendered outside the SPA, so when the
  // server has no OAuth App the button is not offered at all.
  notConfigured?: boolean
}>()

const emit = defineEmits<{ 'use-token': [] }>()

const disconnect = useDisconnectGithub()

async function onDisconnect() {
  try {
    await disconnect.mutateAsync()
    toast.success('GitHub disconnected')
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not disconnect GitHub'))
  }
}
</script>

<template>
  <div class="rounded-xl border border-border bg-card p-5">
    <div class="flex items-center gap-3">
      <div class="flex size-10 items-center justify-center rounded-lg bg-muted">
        <GithubMark class="size-5 text-ink-1" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-medium text-ink-1">GitHub</h2>
        <p class="text-xs text-ink-3">Clone and deploy your repositories.</p>
      </div>
    </div>

    <div class="mt-4">
      <div v-if="props.loading" class="flex items-center gap-3">
        <Skeleton class="h-4 w-40" />
        <Skeleton class="ml-auto h-9 w-28" />
      </div>

      <div
        v-else-if="props.connection"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg bg-sunken px-4 py-3"
      >
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm">
            <span class="text-ink-3">Connected as</span>
            <span class="font-mono font-medium text-ink-1">
              {{ props.connection.accountLogin }}
            </span>
          </p>
          <p class="mt-1 text-xs text-ink-4">
            since {{ relativeTime(props.connection.connectedAt) }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <span
            v-for="scope in props.connection.scopes"
            :key="scope"
            class="font-mono text-xs text-ink-4"
          >
            [{{ scope }}]
          </span>
        </div>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" class="ml-auto text-ink-3 hover:text-destructive">
              <Unplug />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
              <AlertDialogDescription>
                Lighthouse will revoke its access token and stop listing your repositories. Existing
                projects keep running, but private repos can no longer be cloned until you
                reconnect.
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

      <div v-else-if="props.notConfigured" class="rounded-lg bg-sunken px-4 py-3.5">
        <div class="flex items-start gap-2.5">
          <span class="mt-1.5 size-2 shrink-0 rounded-full bg-signal-idle" aria-hidden="true" />
          <div class="min-w-0">
            <p class="text-sm text-ink-1">{{ OAUTH_UNCONFIGURED_TITLE }}</p>
            <p class="mt-1 max-w-prose text-xs leading-relaxed text-ink-3">
              {{ OAUTH_UNCONFIGURED_NOTE }}
            </p>
            <Button variant="outline" size="sm" class="mt-3" @click="emit('use-token')">
              <KeyRound />
              Use an access token
            </Button>
          </div>
        </div>
      </div>

      <div v-else class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-ink-3">
          Connect your GitHub account to browse and deploy your repositories.
        </p>
        <Button @click="connectGithub()">
          <GithubMark class="size-4" />
          Connect GitHub
        </Button>
      </div>
    </div>
  </div>
</template>

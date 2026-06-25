<script setup lang="ts">
import { LoaderCircle, TriangleAlert, Unplug } from '@lucide/vue'
import { toast } from 'vue-sonner'
import GithubMark from './GithubMark.vue'
import { connectGithub } from './integrations.api'
import { useDisconnectGithub } from './integrations.queries'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { Connection } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  connection?: Connection | null
  loading?: boolean
  notConfigured?: boolean
}>()

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
        <GithubMark class="size-5 text-foreground" />
      </div>
      <div class="min-w-0 flex-1">
        <h2 class="text-sm font-medium text-foreground">GitHub</h2>
        <p class="text-xs text-muted-foreground">Clone and deploy your repositories.</p>
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
          <p class="font-medium text-foreground">GitHub integration not configured</p>
          <p class="mt-0.5 text-muted-foreground">
            This Lighthouse instance has no GitHub OAuth app set up. Ask an administrator to
            configure the OAuth client and callback URL.
          </p>
        </div>
      </div>

      <div
        v-else-if="props.connection"
        class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-background/40 px-4 py-3"
      >
        <div class="min-w-0">
          <p class="flex items-center gap-2 text-sm">
            <span class="text-muted-foreground">Connected as</span>
            <span class="font-mono font-medium text-foreground">{{
              props.connection.accountLogin
            }}</span>
          </p>
          <p class="mt-1 text-xs text-muted-foreground">
            since {{ relativeTime(props.connection.connectedAt) }}
          </p>
        </div>

        <div class="flex flex-wrap items-center gap-1.5">
          <Badge v-for="scope in props.connection.scopes" :key="scope" variant="secondary" class="font-mono text-[11px]">
            {{ scope }}
          </Badge>
        </div>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" class="ml-auto text-destructive hover:text-destructive">
              <Unplug />
              Disconnect
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect GitHub?</AlertDialogTitle>
              <AlertDialogDescription>
                Lighthouse will revoke its access token and stop listing your repositories.
                Existing projects keep running, but private repos can no longer be cloned until
                you reconnect.
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

      <div v-else class="flex flex-wrap items-center justify-between gap-3">
        <p class="text-sm text-muted-foreground">
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

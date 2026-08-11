<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { isAxiosError } from 'axios'
import { Building2, LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { previewInvite } from './invitations.api'
import { useAcceptInviteLink } from './invitations.queries'
import { ROLE_BADGE, ROLE_LABEL } from '@/features/orgs/roles'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { apiErrorMessage } from '@/lib/api'
import type { InvitePreview } from '@/types/api'
import AppLogo from '@/components/AppLogo.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

// The route guard guarantees the caller is authenticated before this mounts —
// an unauthenticated visit is bounced to /login?redirect=/invite/:token (then
// back here once signed in/up), so the token survives the round-trip.
const props = defineProps<{ token: string }>()
const router = useRouter()
const active = useActiveOrgStore()
const acceptLink = useAcceptInviteLink()

const preview = ref<InvitePreview | null>(null)
const status = ref<'loading' | 'ready' | 'gone' | 'missing' | 'error'>('loading')
const errorMessage = ref('')

onMounted(async () => {
  try {
    preview.value = await previewInvite(props.token)
    status.value = 'ready'
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 404) status.value = 'missing'
    else if (isAxiosError(err) && err.response?.status === 410) status.value = 'gone'
    else {
      status.value = 'error'
      errorMessage.value = apiErrorMessage(err, 'Could not load this invitation.')
    }
  }
})

async function onAccept() {
  try {
    const result = await acceptLink.mutateAsync(props.token)
    active.setActiveOrg(result.orgId)
    toast.success(`Joined ${preview.value?.orgName ?? 'the organization'}`)
    await router.replace('/')
  } catch (err) {
    if (isAxiosError(err) && err.response?.status === 410) {
      status.value = 'gone'
      return
    }
    toast.error(apiErrorMessage(err, 'Could not accept this invitation'))
  }
}
</script>

<template>
  <div class="flex min-h-svh items-center justify-center p-6">
    <div class="w-full max-w-sm">
      <div class="mb-8 flex justify-center">
        <AppLogo :size="30" />
      </div>

      <div class="rounded-xl border border-border bg-card p-6 text-center">
        <div v-if="status === 'loading'" class="flex flex-col items-center py-6">
          <LoaderCircle class="size-6 animate-spin text-muted-foreground" />
          <p class="mt-3 text-sm text-muted-foreground">Loading invitation…</p>
        </div>

        <template v-else-if="status === 'ready' && preview">
          <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
            <Building2 class="size-6 text-primary" />
          </div>
          <h1 class="mt-4 text-lg font-semibold tracking-tight text-foreground">
            Join {{ preview.orgName }}
          </h1>
          <p class="mt-1 text-sm text-muted-foreground">
            @{{ preview.inviterUsername }} invited you to join as
          </p>
          <Badge :variant="ROLE_BADGE[preview.role]" class="mt-2">{{ ROLE_LABEL[preview.role] }}</Badge>

          <Button class="mt-6 w-full" :disabled="acceptLink.isPending.value" @click="onAccept">
            <LoaderCircle v-if="acceptLink.isPending.value" class="animate-spin" />
            Accept invitation
          </Button>
          <button
            type="button"
            class="mt-3 text-sm text-muted-foreground transition-colors hover:text-foreground"
            @click="router.replace('/')"
          >
            Maybe later
          </button>
        </template>

        <template v-else>
          <h1 class="text-lg font-semibold tracking-tight text-foreground">
            {{ status === 'missing' ? 'Invitation not found' : status === 'gone' ? 'Invitation expired' : 'Something went wrong' }}
          </h1>
          <p class="mt-2 text-sm text-muted-foreground">
            <template v-if="status === 'missing'">
              This invite link is invalid. Ask an organization admin for a new one.
            </template>
            <template v-else-if="status === 'gone'">
              This invite link has already been used or has expired. Ask for a fresh one.
            </template>
            <template v-else>{{ errorMessage }}</template>
          </p>
          <Button variant="outline" class="mt-6 w-full" @click="router.replace('/')">
            Go to dashboard
          </Button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { Check, LoaderCircle, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useAcceptInvitation,
  useDeclineInvitation,
} from '@/features/invitations/invitations.queries'
import { ROLE_BADGE, ROLE_LABEL } from '@/features/orgs/roles'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { apiErrorMessage } from '@/lib/api'
import { shortAgo } from '@/lib/time'
import type { MyInvitation } from '@/types/api'
import { Badge } from '@/components/ui/badge'

const props = defineProps<{ invitation: MyInvitation; now: number }>()

const accept = useAcceptInvitation()
const decline = useDeclineInvitation()
const active = useActiveOrgStore()
const busy = ref(false)

async function onAccept() {
  busy.value = true
  try {
    await accept.mutateAsync(props.invitation.id)
    // Drop straight into the org you just joined.
    active.setActiveOrg(props.invitation.organization.id)
    toast.success(`Joined ${props.invitation.organization.name}`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not accept invitation'))
  } finally {
    busy.value = false
  }
}

async function onDecline() {
  busy.value = true
  try {
    await decline.mutateAsync(props.invitation.id)
    toast.success('Invitation declined')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not decline invitation'))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <!-- A pending invitation always needs you, so it always carries the marker. -->
  <li
    class="relative bg-primary/[0.04] py-2.5 pl-3 pr-3 before:absolute before:inset-y-0 before:left-0 before:w-0.5 before:bg-primary"
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0">
        <p class="truncate text-sm leading-snug text-ink-1">
          {{ invitation.organization.name }}
        </p>
        <p class="mt-0.5 truncate font-mono text-[0.6875rem] text-ink-4">
          @{{ invitation.invitedBy.username }} · {{ shortAgo(invitation.createdAt, now) }}
        </p>
      </div>
      <Badge :variant="ROLE_BADGE[invitation.role]" class="shrink-0">
        {{ ROLE_LABEL[invitation.role] }}
      </Badge>
    </div>

    <div class="mt-2 flex items-center gap-2">
      <button
        type="button"
        class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        :disabled="busy"
        @click="onAccept"
      >
        <LoaderCircle v-if="busy" class="size-3.5 animate-spin" />
        <Check v-else class="size-3.5" />
        Accept
      </button>
      <button
        type="button"
        class="inline-flex items-center justify-center gap-1.5 rounded-md border border-rule px-2.5 py-1.5 text-xs font-medium text-ink-3 transition-colors hover:bg-accent hover:text-ink-1 disabled:opacity-50"
        :disabled="busy"
        @click="onDecline"
      >
        <X class="size-3.5" />
        Decline
      </button>
    </div>
  </li>
</template>

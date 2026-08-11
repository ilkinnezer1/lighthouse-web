<script setup lang="ts">
import { ref } from 'vue'
import { onClickOutside } from '@vueuse/core'
import { Bell, Check, LoaderCircle, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useAcceptInvitation, useDeclineInvitation, useMyInvitations } from './invitations.queries'
import { ROLE_BADGE, ROLE_LABEL } from '@/features/orgs/roles'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { MyInvitation } from '@/types/api'
import { Badge } from '@/components/ui/badge'

const { data: invitations } = useMyInvitations()
const accept = useAcceptInvitation()
const decline = useDeclineInvitation()
const active = useActiveOrgStore()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
onClickOutside(root, () => (open.value = false))

// Track the row being acted on so only its buttons spin.
const busyId = ref<string | null>(null)

async function onAccept(inv: MyInvitation) {
  busyId.value = inv.id
  try {
    await accept.mutateAsync(inv.id)
    // Drop straight into the org you just joined.
    active.setActiveOrg(inv.organization.id)
    toast.success(`Joined ${inv.organization.name}`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not accept invitation'))
  } finally {
    busyId.value = null
  }
}

async function onDecline(inv: MyInvitation) {
  busyId.value = inv.id
  try {
    await decline.mutateAsync(inv.id)
    toast.success('Invitation declined')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not decline invitation'))
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      title="Invitations"
      @click="open = !open"
    >
      <Bell class="size-4.5" />
      <span
        v-if="invitations && invitations.length"
        class="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground"
      >
        {{ invitations.length }}
      </span>
    </button>

    <div
      v-if="open"
      class="absolute right-0 top-full z-30 mt-1 w-80 overflow-hidden rounded-md border border-border bg-popover shadow-lg"
    >
      <p class="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">
        Invitations
      </p>

      <p
        v-if="!invitations || invitations.length === 0"
        class="px-3 py-6 text-center text-sm text-muted-foreground"
      >
        No pending invitations.
      </p>

      <ul v-else class="max-h-96 divide-y divide-border overflow-y-auto">
        <li v-for="inv in invitations" :key="inv.id" class="px-3 py-3">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0">
              <p class="truncate text-sm font-medium text-foreground">
                {{ inv.organization.name }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                from @{{ inv.invitedBy.username }} · {{ relativeTime(inv.createdAt) }}
              </p>
            </div>
            <Badge :variant="ROLE_BADGE[inv.role]" class="shrink-0">{{
              ROLE_LABEL[inv.role]
            }}</Badge>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <button
              type="button"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              :disabled="busyId === inv.id"
              @click="onAccept(inv)"
            >
              <LoaderCircle v-if="busyId === inv.id" class="size-3.5 animate-spin" />
              <Check v-else class="size-3.5" />
              Accept
            </button>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              :disabled="busyId === inv.id"
              @click="onDecline(inv)"
            >
              <X class="size-3.5" />
              Decline
            </button>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>

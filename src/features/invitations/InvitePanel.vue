<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, Link2, LoaderCircle, Mail, Send, Trash2, UserPlus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useCreateInviteLink,
  useInviteUser,
  useOrgInvitations,
  useRevokeInvitation,
} from './invitations.queries'
import { ROLE_BADGE, ROLE_LABEL } from '@/features/orgs/roles'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { CreateInvitationInput, InviteLinkResult, OrgRole } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{ orgId: string; actorRole: OrgRole | undefined }>()

const { data: pending } = useOrgInvitations(() => props.orgId)
const inviteUser = useInviteUser(() => props.orgId)
const createLink = useCreateInviteLink(() => props.orgId)
const revoke = useRevokeInvitation(() => props.orgId)

// Only an Owner may invite an Owner — mirrors the server guard cosmetically.
const inviteRoles = computed<OrgRole[]>(() =>
  props.actorRole === 'OWNER'
    ? ['ADMIN', 'MEMBER', 'VIEWER', 'OWNER']
    : ['ADMIN', 'MEMBER', 'VIEWER'],
)

const identifier = ref('')
const role = ref<OrgRole>('MEMBER')
const minted = ref<InviteLinkResult | null>(null)

async function onInvite() {
  const value = identifier.value.trim()
  if (!value) return
  // The API accepts either field; a value with "@" is treated as an email.
  const input: CreateInvitationInput = value.includes('@')
    ? { role: role.value, email: value }
    : { role: role.value, username: value }
  try {
    await inviteUser.mutateAsync(input)
    toast.success('Invitation sent')
    identifier.value = ''
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not send invitation'))
  }
}

async function onMintLink() {
  try {
    minted.value = await createLink.mutateAsync(role.value)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not create invite link'))
  }
}

async function copyLink() {
  if (!minted.value) return
  try {
    await navigator.clipboard.writeText(minted.value.tokenLink)
    toast.success('Invite link copied')
  } catch {
    toast.error('Copy failed')
  }
}

async function onRevoke(id: string) {
  try {
    await revoke.mutateAsync(id)
    toast.success('Invitation revoked')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not revoke invitation'))
  }
}
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Invite people</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      Add an existing user by username or email, or share a one-time invite link.
    </p>

    <div class="mt-3 space-y-4 rounded-xl border border-border bg-card p-4">
      <div class="flex flex-wrap items-end gap-2">
        <div class="min-w-48 flex-1 space-y-1.5">
          <Label for="invite-id">Username or email</Label>
          <Input
            id="invite-id"
            v-model="identifier"
            placeholder="ada-lovelace"
            autocomplete="off"
          />
        </div>
        <div class="w-32 space-y-1.5">
          <Label for="invite-role">Role</Label>
          <Select v-model="role">
            <SelectTrigger id="invite-role" class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="r in inviteRoles" :key="r" :value="r">
                {{ ROLE_LABEL[r] }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button :disabled="inviteUser.isPending.value || !identifier.trim()" @click="onInvite">
          <LoaderCircle v-if="inviteUser.isPending.value" class="animate-spin" />
          <Send v-else />
          Invite
        </Button>
      </div>

      <div class="flex items-center justify-between gap-2 border-t border-border pt-3">
        <p class="text-xs text-muted-foreground">
          Or mint a link anyone can use to join as <strong>{{ ROLE_LABEL[role] }}</strong
          >.
        </p>
        <Button
          variant="outline"
          size="sm"
          :disabled="createLink.isPending.value"
          @click="onMintLink"
        >
          <LoaderCircle v-if="createLink.isPending.value" class="animate-spin" />
          <Link2 v-else />
          Create invite link
        </Button>
      </div>

      <!-- One-time link: shown once; the server keeps only its hash. -->
      <div v-if="minted" class="rounded-lg border border-primary/30 bg-primary/5 p-3">
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <Check class="size-3.5 text-primary" />
          Copy it now — it won't be shown again.
          <Badge :variant="ROLE_BADGE[minted.role]" class="ml-auto">{{
            ROLE_LABEL[minted.role]
          }}</Badge>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <code
            class="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground"
            >{{ minted.tokenLink }}</code
          >
          <Button variant="ghost" size="icon-sm" title="Copy link" @click="copyLink">
            <Copy />
          </Button>
        </div>
        <p class="mt-1.5 text-xs text-muted-foreground/70">
          Expires {{ relativeTime(minted.expiresAt) }}.
        </p>
      </div>
    </div>

    <!-- Pending invitations -->
    <div v-if="pending && pending.length" class="mt-4">
      <h3 class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Pending invitations
      </h3>
      <div class="mt-2 divide-y divide-border overflow-hidden rounded-xl border border-border">
        <div
          v-for="inv in pending"
          :key="inv.id"
          class="flex items-center gap-3 bg-card px-4 py-2.5"
        >
          <UserPlus v-if="inv.invitee" class="size-4 shrink-0 text-muted-foreground" />
          <Mail v-else-if="inv.email" class="size-4 shrink-0 text-muted-foreground" />
          <Link2 v-else class="size-4 shrink-0 text-muted-foreground" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-foreground">
              {{ inv.invitee ? '@' + inv.invitee.username : inv.email || 'Invite link' }}
            </p>
            <p class="truncate text-xs text-muted-foreground">
              by @{{ inv.invitedBy.username }} · expires {{ relativeTime(inv.expiresAt) }}
            </p>
          </div>
          <Badge :variant="ROLE_BADGE[inv.role]" class="shrink-0">{{ ROLE_LABEL[inv.role] }}</Badge>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-destructive"
            title="Revoke invitation"
            :disabled="revoke.isPending.value"
            @click="onRevoke(inv.id)"
          >
            <Trash2 />
          </Button>
        </div>
      </div>
    </div>
  </section>
</template>

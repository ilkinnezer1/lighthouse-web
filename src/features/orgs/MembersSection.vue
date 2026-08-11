<script setup lang="ts">
import { LoaderCircle, UserMinus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useChangeMemberRole, useOrgMembers, useRemoveMember } from './orgs.queries'
import { canManageRole, ORG_ROLES, ROLE_BADGE, ROLE_LABEL, roleCan } from './roles'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { OrgMember, OrgRole } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

// The caller's own role in THIS org (from GET /orgs), used to mirror the server
// guardrails: can't touch your own role; only an Owner may act on / appoint an Owner.
const props = defineProps<{
  orgId: string
  actorRole: OrgRole | undefined
  currentUserId: string | undefined
}>()

const { data: members, isPending, isError } = useOrgMembers(() => props.orgId)
const changeRole = useChangeMemberRole(() => props.orgId)
const removeMember = useRemoveMember(() => props.orgId)

function isSelf(m: OrgMember) {
  return m.userId === props.currentUserId
}

function canEditMember(m: OrgMember) {
  return !isSelf(m) && canManageRole(props.actorRole, m.role)
}

// Only an Owner may grant ownership, so non-owners can't pick OWNER as a target.
function roleOptionDisabled(role: OrgRole) {
  return role === 'OWNER' && props.actorRole !== 'OWNER'
}

async function onRoleChange(m: OrgMember, role: OrgRole) {
  if (role === m.role) return
  try {
    await changeRole.mutateAsync({ userId: m.userId, role })
    toast.success(`${m.displayName || m.username} is now ${ROLE_LABEL[role]}`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not change role'))
  }
}

async function onRemove(m: OrgMember) {
  try {
    await removeMember.mutateAsync(m.userId)
    toast.success(`Removed ${m.displayName || m.username}`)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not remove member'))
  }
}

const canManage = () => roleCan(props.actorRole, 'members.manage')
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold tracking-tight text-foreground">Members</h2>
    <p class="mt-1 text-sm text-muted-foreground">
      People with access to this organization and their roles.
    </p>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 3" :key="n" class="h-14 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load members.</p>

    <div v-else class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
      <div
        v-for="m in members ?? []"
        :key="m.userId"
        class="flex items-center gap-3 bg-card px-4 py-3"
      >
        <div
          class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
        >
          {{ (m.displayName || m.username).charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-foreground">
            {{ m.displayName || m.username }}
            <span v-if="isSelf(m)" class="text-xs font-normal text-muted-foreground">(you)</span>
          </p>
          <p class="truncate font-mono text-xs text-muted-foreground">
            @{{ m.username }} · joined {{ relativeTime(m.joinedAt) }}
          </p>
        </div>

        <Select
          v-if="canEditMember(m)"
          :model-value="m.role"
          @update:model-value="(v) => onRoleChange(m, v as OrgRole)"
        >
          <SelectTrigger class="h-8 w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="role in ORG_ROLES"
              :key="role"
              :value="role"
              :disabled="roleOptionDisabled(role)"
            >
              {{ ROLE_LABEL[role] }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Badge v-else :variant="ROLE_BADGE[m.role]" class="shrink-0">
          {{ ROLE_LABEL[m.role] }}
        </Badge>

        <AlertDialog v-if="canManage() && !isSelf(m)">
          <AlertDialogTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="text-muted-foreground hover:text-destructive"
              title="Remove member"
              :disabled="!canEditMember(m)"
            >
              <UserMinus />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {{ m.displayName || m.username }}?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access to this organization's projects, deployments, and databases.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-white hover:bg-destructive/90"
                :disabled="removeMember.isPending.value"
                @click="onRemove(m)"
              >
                <LoaderCircle v-if="removeMember.isPending.value" class="animate-spin" />
                Remove
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  </section>
</template>

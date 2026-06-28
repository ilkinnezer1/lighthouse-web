<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ArrowLeft, Building2, LoaderCircle, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDeleteOrg, useOrgs, useRenameOrg } from './orgs.queries'
import { useActiveOrgStore } from './active-org.store'
import { ROLE_BADGE, ROLE_LABEL, roleCan } from './roles'
import MembersSection from './MembersSection.vue'
import InvitePanel from '@/features/invitations/InvitePanel.vue'
import { useAuthStore } from '@/features/auth/auth.store'
import { apiErrorMessage } from '@/lib/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{ id: string }>()
const router = useRouter()
const auth = useAuthStore()
const active = useActiveOrgStore()

const { data: orgs, isPending } = useOrgs()
const org = computed(() => orgs.value?.find((o) => o.id === props.id))
const role = computed(() => org.value?.role)

const canRename = computed(() => !!org.value && !org.value.isPersonal && roleCan(role.value, 'org.update'))
const canDelete = computed(() => !!org.value && !org.value.isPersonal && roleCan(role.value, 'org.delete'))
const canInvite = computed(() => !!org.value && !org.value.isPersonal && roleCan(role.value, 'members.manage'))

const name = ref('')
watch(org, (o) => { if (o) name.value = o.name }, { immediate: true })

const rename = useRenameOrg(() => props.id)
const remove = useDeleteOrg()

const dirty = computed(() => !!org.value && name.value.trim() !== org.value.name && !!name.value.trim())

async function onRename() {
  if (!dirty.value) return
  try {
    await rename.mutateAsync(name.value.trim())
    toast.success('Organization renamed')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not rename organization'))
  }
}

async function onDelete() {
  try {
    await remove.mutateAsync(props.id)
    toast.success('Organization deleted')
    // Fall back to the personal org (the API's default scope).
    active.setActiveOrg(null)
    await router.replace('/')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not delete organization'))
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
    <RouterLink
      to="/"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Dashboard
    </RouterLink>

    <div v-if="isPending" class="mt-6 space-y-6">
      <Skeleton class="h-8 w-56" />
      <Skeleton class="h-32 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <div
      v-else-if="!org"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-border py-16 text-center"
    >
      <Building2 class="size-6 text-muted-foreground" />
      <p class="mt-3 text-sm text-muted-foreground">
        Organization not found, or you're no longer a member.
      </p>
    </div>

    <template v-else>
      <header class="mt-4 flex items-center gap-3">
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ org.name }}</h1>
        <Badge v-if="role" :variant="ROLE_BADGE[role]">{{ ROLE_LABEL[role] }}</Badge>
        <Badge v-if="org.isPersonal" variant="outline">Personal</Badge>
      </header>
      <p class="mt-1 font-mono text-sm text-muted-foreground">{{ org.slug }}</p>

      <!-- General -->
      <section v-if="canRename" class="mt-8">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">General</h2>
        <div class="mt-3 flex flex-wrap items-end gap-2 rounded-xl border border-border bg-card p-4">
          <div class="min-w-48 flex-1 space-y-1.5">
            <Label for="org-name">Name</Label>
            <Input id="org-name" v-model="name" maxlength="80" />
          </div>
          <Button :disabled="!dirty || rename.isPending.value" @click="onRename">
            <LoaderCircle v-if="rename.isPending.value" class="animate-spin" />
            Save
          </Button>
        </div>
      </section>

      <p
        v-else-if="org.isPersonal"
        class="mt-8 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground"
      >
        This is your personal organization. It can't be renamed or deleted, and you can't invite
        others to it. Create a shared organization to collaborate.
      </p>

      <MembersSection
        class="mt-10 block"
        :org-id="id"
        :actor-role="role"
        :current-user-id="auth.user?.id"
      />

      <InvitePanel v-if="canInvite" class="mt-10 block" :org-id="id" :actor-role="role" />

      <!-- Danger zone -->
      <section v-if="canDelete" class="mt-12">
        <h2 class="text-sm font-semibold tracking-tight text-destructive">Danger zone</h2>
        <div
          class="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4"
        >
          <div>
            <p class="text-sm font-medium text-foreground">Delete this organization</p>
            <p class="mt-0.5 text-sm text-muted-foreground">
              Only possible once it has no projects. This cannot be undone.
            </p>
          </div>
          <AlertDialog>
            <AlertDialogTrigger as-child>
              <Button variant="outline" size="sm" class="text-destructive hover:text-destructive">
                <Trash2 />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {{ org.name }}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Every member loses access. If the organization still has projects, deletion is
                  blocked until you remove them.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="default"
                  class="bg-destructive text-white hover:bg-destructive/90"
                  :disabled="remove.isPending.value"
                  @click="onDelete"
                >
                  <LoaderCircle v-if="remove.isPending.value" class="animate-spin" />
                  Delete organization
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </section>
    </template>
  </div>
</template>

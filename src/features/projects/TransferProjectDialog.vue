<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Building2, Check, LoaderCircle, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useTransferProject } from './projects.queries'
import { useOrgs } from '@/features/orgs/orgs.queries'
import { ROLE_BADGE, ROLE_LABEL, roleCan } from '@/features/orgs/roles'
import { apiErrorMessage } from '@/lib/api'
import type { Project } from '@/types/api'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{ project: Project }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ transferred: [organizationId: string] }>()

const { data: orgs } = useOrgs()
const transfer = useTransferProject()

// Destinations the actor can bring this project into: orgs where their role
// grants create rights, excluding the org that already owns it. The server
// re-checks both ends — this only declutters the picker.
const destinations = computed(() =>
  (orgs.value ?? []).filter(
    (o) =>
      o.id !== props.project.organizationId && roleCan(o.role, 'project.create'),
  ),
)

const targetId = ref<string | null>(null)
const target = computed(() => destinations.value.find((o) => o.id === targetId.value))

watch(open, (isOpen) => {
  if (isOpen) targetId.value = null
})

async function onTransfer() {
  if (!targetId.value) return
  const dest = target.value
  try {
    await transfer.mutateAsync({
      projectId: props.project.id,
      organizationId: targetId.value,
    })
    toast.success(`${props.project.name} moved to ${dest?.name ?? 'organization'}`)
    open.value = false
    emit('transferred', targetId.value)
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not transfer project'))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Transfer to organization</DialogTitle>
        <DialogDescription>
          Move
          <span class="font-medium text-foreground">{{ project.name }}</span>
          — with its environments, deployments, and databases — to another
          organization. Its public URL keeps serving.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-2 py-1">
        <p
          v-if="destinations.length === 0"
          class="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground"
        >
          No other organizations you can transfer into. You need create access in
          a different organization.
        </p>

        <button
          v-for="org in destinations"
          :key="org.id"
          type="button"
          :class="[
            'flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors',
            targetId === org.id
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground/40',
          ]"
          @click="targetId = org.id"
        >
          <span class="flex min-w-0 items-center gap-2.5">
            <Building2 class="size-4 shrink-0 text-muted-foreground" />
            <span class="min-w-0">
              <span class="block truncate text-sm text-foreground">{{ org.name }}</span>
              <span class="block truncate font-mono text-xs text-muted-foreground">
                {{ org.slug }}
              </span>
            </span>
          </span>
          <span class="flex shrink-0 items-center gap-2">
            <Badge v-if="org.isPersonal" variant="outline">Personal</Badge>
            <Badge :variant="ROLE_BADGE[org.role]">{{ ROLE_LABEL[org.role] }}</Badge>
            <Check v-if="targetId === org.id" class="size-4 text-primary" />
          </span>
        </button>
      </div>

      <!-- Moving into a personal org makes it single-member: the current team
           loses access. -->
      <div
        v-if="target?.isPersonal"
        class="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm text-foreground"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-primary" />
        <p>
          This is a personal organization. The current team will lose access — only
          you will keep it.
        </p>
      </div>

      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          :disabled="transfer.isPending.value"
          @click="open = false"
        >
          Cancel
        </Button>
        <Button
          type="button"
          :disabled="!targetId || transfer.isPending.value"
          @click="onTransfer"
        >
          <LoaderCircle v-if="transfer.isPending.value" class="animate-spin" />
          Transfer
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

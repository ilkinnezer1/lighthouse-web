<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useCreateOrg } from './orgs.queries'
import { apiErrorMessage } from '@/lib/api'
import type { OrgSummary } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [org: OrgSummary] }>()

const createOrg = useCreateOrg()
const name = ref('')

watch(open, (isOpen) => {
  if (isOpen) name.value = ''
})

async function onSubmit() {
  const trimmed = name.value.trim()
  if (!trimmed) return
  try {
    const org = await createOrg.mutateAsync(trimmed)
    toast.success('Organization created')
    open.value = false
    emit('created', org)
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not create organization'))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>New organization</DialogTitle>
        <DialogDescription>
          A shared workspace for your team. You become its owner.
        </DialogDescription>
      </DialogHeader>

      <form id="create-org" class="grid gap-2 py-2" novalidate @submit.prevent="onSubmit">
        <Label for="org-name">Name</Label>
        <Input
          id="org-name"
          v-model="name"
          placeholder="Acme Inc."
          maxlength="80"
          autofocus
        />
      </form>

      <DialogFooter>
        <Button
          variant="outline"
          type="button"
          :disabled="createOrg.isPending.value"
          @click="open = false"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          form="create-org"
          :disabled="createOrg.isPending.value || !name.trim()"
        >
          <LoaderCircle v-if="createOrg.isPending.value" class="animate-spin" />
          Create
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

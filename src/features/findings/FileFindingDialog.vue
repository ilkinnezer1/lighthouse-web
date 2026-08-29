<script setup lang="ts">
import { computed, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { createFindingSchema } from './findings.schemas'
import { useCreateFinding } from './findings.queries'
import { apiErrorMessage } from '@/lib/api'
import { shortSha } from '@/lib/utils'
import type { CreateFindingInput, Deployment, Finding } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const props = defineProps<{
  deployment: Deployment
  prefillTitle?: string
  heading?: string
  deck?: string
  actionLabel?: string
  /**
   * Hands the finding to the caller instead of posting it here. The checklist
   * sends it through its own check route so one call records both the fail and
   * the bug — the caller owns the success message it produces.
   */
  submit?: (input: CreateFindingInput) => Promise<unknown>
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [finding: Finding] }>()

const create = useCreateFinding(() => props.deployment.id)
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(createFindingSchema),
})

watch(open, (isOpen) => {
  if (isOpen) resetForm({ values: { title: props.prefillTitle ?? '', body: '' } })
})

const sha = computed(() => shortSha(props.deployment.commitSha))
const source = computed(() => props.deployment.branches?.find((b) => b.role === 'SOURCE') ?? null)
const mergeCount = computed(
  () => props.deployment.branches?.filter((b) => b.role === 'MERGE').length ?? 0,
)

const onSubmit = handleSubmit(async (values) => {
  const input: CreateFindingInput = {
    title: values.title.trim(),
    body: values.body?.trim() || undefined,
  }
  try {
    if (props.submit) {
      await props.submit(input)
    } else {
      const finding = await create.mutateAsync(input)
      toast.success(sha.value ? `Finding filed against ${sha.value}` : 'Finding filed')
      emit('created', finding)
    }
    open.value = false
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not file the finding'))
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ heading ?? 'Report a finding' }}</DialogTitle>
        <DialogDescription>
          {{
            deck ??
            'Pinned to this build, not to the environment — so it still says which code was running after this environment moves on.'
          }}
        </DialogDescription>
      </DialogHeader>

      <form id="file-finding" class="grid gap-4 py-2" novalidate @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="title">
          <FormItem>
            <FormLabel>What went wrong</FormLabel>
            <FormControl>
              <Input placeholder="Checkout total is wrong with a coupon" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="body">
          <FormItem>
            <FormLabel>
              Steps or detail
              <span class="font-normal text-muted-foreground">(optional)</span>
            </FormLabel>
            <FormControl>
              <Textarea
                rows="3"
                placeholder="Anything the build can't tell them."
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!--
          Spelled out because the alternative is someone pasting the SHA into
          the title by hand — which is exactly the round trip this replaces.
        -->
        <div class="rounded-lg bg-sunken px-3 py-2.5">
          <p class="eyebrow">Attached automatically</p>
          <dl class="mt-2 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-xs">
            <dt class="text-ink-4">Build</dt>
            <dd class="min-w-0 truncate text-ink-2">
              <span class="font-mono">{{ sha ?? 'this deployment' }}</span>
              <template v-if="deployment.commitMessage"> · {{ deployment.commitMessage }}</template>
            </dd>

            <dt class="text-ink-4">Branch</dt>
            <dd class="min-w-0 truncate font-mono text-ink-2">
              {{ source?.name ?? deployment.environment?.branch ?? '—' }}
              <span v-if="source?.issueKey" class="text-ink-3">· {{ source.issueKey }}</span>
              <span v-if="mergeCount" class="font-sans text-ink-3">
                · +{{ mergeCount }} merged
              </span>
            </dd>

            <dt class="text-ink-4">Environment</dt>
            <dd class="min-w-0 truncate text-ink-2">{{ deployment.environment?.name ?? '—' }}</dd>

            <dt class="text-ink-4">Logs</dt>
            <dd class="min-w-0 text-ink-2">
              A snapshot of the runtime logs, if the container is still up
            </dd>
          </dl>
        </div>
      </form>

      <DialogFooter>
        <!-- Where a caller offers a way out that still records something —
             the checklist's "fail it without writing the bug up". -->
        <slot name="secondary" />
        <Button variant="ghost" type="button" @click="open = false">Cancel</Button>
        <Button type="submit" form="file-finding" :disabled="isSubmitting">
          <LoaderCircle v-if="isSubmitting" class="animate-spin" />
          {{ actionLabel ?? 'File finding' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { ListChecks, ListPlus, LoaderCircle, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useCheckItem,
  useChecklist,
  useCreateChecklistItem,
  useDeleteChecklistItem,
  useSeedChecklist,
  useUncheckItem,
} from './checklist.queries'
import { createChecklistItemSchema } from './checklist.schemas'
import { checkedRatio, progressLabel } from './checklist.progress'
import { seedLabel } from './checklist.format'
import ChecklistItemRow from './ChecklistItemRow.vue'
import FileFindingDialog from '@/features/findings/FileFindingDialog.vue'
import { useCan } from '@/features/orgs/useCan'
import { apiErrorMessage } from '@/lib/api'
import { shortSha } from '@/lib/utils'
import type { ChecklistItem, CreateFindingInput, Deployment } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'

const props = defineProps<{ deployment: Deployment }>()

const query = useChecklist(() => props.deployment.id)
const checklist = computed(() => query.data.value ?? null)
const items = computed(() => checklist.value?.items ?? [])
const summary = computed(
  () => checklist.value?.summary ?? { total: 0, passed: 0, failed: 0, remaining: 0 },
)
const seedable = computed(() => checklist.value?.seedable ?? 0)

const canCheck = useCan('deploy')
const sha = computed(() => shortSha(props.deployment.commitSha))

const seed = useSeedChecklist(() => props.deployment.id)
const create = useCreateChecklistItem(() => props.deployment.id)
const remove = useDeleteChecklistItem()
const check = useCheckItem(() => props.deployment.id)
const uncheck = useUncheckItem(() => props.deployment.id)

// One row at a time — the controls are per-row, so the spinner has to be too.
const busyId = ref<string | null>(null)

async function run(itemId: string, work: () => Promise<unknown>, fallback: string) {
  busyId.value = itemId
  try {
    await work()
  } catch (error) {
    toast.error(apiErrorMessage(error, fallback))
  } finally {
    busyId.value = null
  }
}

function onPass(item: ChecklistItem) {
  return run(
    item.id,
    async () => {
      await check.mutateAsync({ itemId: item.id, result: 'PASS' })
      toast.success(sha.value ? `Passed on ${sha.value}` : 'Marked passed')
    },
    'Could not record the pass',
  )
}

function onUndo(item: ChecklistItem) {
  return run(
    item.id,
    async () => {
      await uncheck.mutateAsync(item.id)
      toast.success('Check removed')
    },
    'Could not remove the check',
  )
}

function onRemove(item: ChecklistItem) {
  return run(
    item.id,
    async () => {
      await remove.mutateAsync(item.id)
      toast.success('Item removed')
    },
    'Could not remove the item',
  )
}

async function onSeed() {
  const adding = seedable.value
  try {
    await seed.mutateAsync()
    toast.success(`Added ${adding} item${adding === 1 ? '' : 's'} from this build`)
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not seed the checklist'))
  }
}

// A fail is a bug report waiting to happen, so it goes through the same dialog
// as any other finding — sent through the check route, which files it and
// records the fail in one call rather than leaving two half-written records.
const failing = ref<ChecklistItem | null>(null)
const failOpen = computed({
  get: () => failing.value !== null,
  set: (open: boolean) => {
    if (!open) failing.value = null
  },
})

async function submitFail(input: CreateFindingInput) {
  const item = failing.value
  if (!item) return
  await check.mutateAsync({
    itemId: item.id,
    result: 'FAIL',
    finding: { title: input.title, body: input.body },
  })
  toast.success(sha.value ? `Failed on ${sha.value} — finding filed` : 'Failed — finding filed')
}

function failWithoutReport() {
  const item = failing.value
  if (!item) return
  failing.value = null
  return run(
    item.id,
    async () => {
      await check.mutateAsync({ itemId: item.id, result: 'FAIL' })
      toast.success(sha.value ? `Failed on ${sha.value}` : 'Marked failed')
    },
    'Could not record the fail',
  )
}

const adding = ref(false)
const titleInput = useTemplateRef<HTMLInputElement>('titleInput')
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(createChecklistItemSchema),
})

async function startAdding() {
  adding.value = true
  await nextTick()
  titleInput.value?.focus()
}

const onAdd = handleSubmit(async (values) => {
  try {
    await create.mutateAsync(values.title.trim())
    resetForm()
    await nextTick()
    titleInput.value?.focus()
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not add the item'))
  }
})
</script>

<template>
  <section class="mt-6">
    <div class="flex items-center justify-between gap-4">
      <h2 class="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
        <ListChecks class="size-3.5 text-muted-foreground" />
        Test checklist
        <span v-if="summary.total" class="font-mono text-xs font-normal text-ink-4">
          {{ progressLabel(summary) }}
        </span>
        <span v-if="summary.failed" class="font-mono text-xs font-normal text-signal-error">
          {{ summary.failed }} failed
        </span>
      </h2>

      <div v-if="canCheck" class="flex shrink-0 items-center gap-1">
        <Button
          v-if="seedable"
          variant="ghost"
          size="sm"
          :disabled="seed.isPending.value"
          :title="`${seedable} ticket${seedable === 1 ? '' : 's'} in this build's changes are not on the list yet`"
          @click="onSeed"
        >
          <LoaderCircle v-if="seed.isPending.value" class="animate-spin" />
          <ListPlus v-else />
          {{ seedLabel(seedable) }}
        </Button>

        <Button v-if="!adding" variant="ghost" size="sm" @click="startAdding">
          <Plus />
          Add item
        </Button>
      </div>
    </div>

    <!-- The meter is a hairline, not a bar: it belongs to the rule that
         separates the rows, and only the amber fill is new ink on the page. -->
    <div v-if="summary.total" class="mt-3 h-px w-full bg-rule">
      <div
        class="h-px bg-primary transition-[width] duration-300"
        :style="{ width: `${checkedRatio(summary) * 100}%` }"
      />
    </div>

    <form v-if="adding && canCheck" class="mt-3 flex items-start gap-2" novalidate @submit="onAdd">
      <FormField v-slot="{ componentField }" name="title">
        <FormItem class="flex-1">
          <FormControl>
            <Input
              ref="titleInput"
              class="h-8"
              placeholder="Check the coupon rules on checkout"
              v-bind="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>
      <Button type="submit" size="sm" :disabled="isSubmitting">
        <LoaderCircle v-if="isSubmitting" class="animate-spin" />
        Add
      </Button>
      <Button type="button" variant="ghost" size="sm" @click="adding = false">Done</Button>
    </form>

    <p v-if="query.isError.value" class="mt-2 text-xs text-ink-4">Could not load the checklist.</p>

    <p v-else-if="!query.isPending.value && items.length === 0" class="mt-2 text-xs text-ink-4">
      Nothing to test on this environment yet. The list belongs to the environment, so anything
      added here carries over to the next build.
    </p>

    <div v-else-if="items.length" class="mt-1 rule-y">
      <ChecklistItemRow
        v-for="item in items"
        :key="item.id"
        :item="item"
        :build="checklist!.deployment"
        :can-check="canCheck"
        :busy="busyId === item.id"
        @pass="onPass(item)"
        @fail="failing = item"
        @undo="onUndo(item)"
        @remove="onRemove(item)"
      />
    </div>

    <FileFindingDialog
      v-model:open="failOpen"
      :deployment="deployment"
      :prefill-title="failing?.title"
      heading="Fail this check"
      deck="The fail and the bug report are recorded together, both against this build — so nobody has to write the same thing twice."
      action-label="Fail and file"
      :submit="submitFail"
    >
      <template #secondary>
        <!-- "Tried it, broken, no time to write it up" is a real state, and
             demanding a bug report is how a checklist stops being used. -->
        <Button variant="ghost" type="button" class="sm:mr-auto" @click="failWithoutReport">
          Fail without a report
        </Button>
      </template>
    </FileFindingDialog>
  </section>
</template>

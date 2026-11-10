<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileUp, LoaderCircle, TriangleAlert, Upload } from '@lucide/vue'
import { toast } from 'vue-sonner'
import type { ManagedDatabase } from '@/types/api'
import { formatBytes } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { useImportDump } from './snapshots.queries'
import {
  importAccept,
  importErrorMessage,
  importExtensions,
  isAcceptedImportFile,
} from './snapshots.import'

const props = defineProps<{
  database: Pick<ManagedDatabase, 'id' | 'name' | 'type'>
  disabled?: boolean
  disabledReason?: string
}>()

const open = ref(false)
const file = ref<File | null>(null)
const confirmed = ref(false)
const loaded = ref(0)
const total = ref(0)
const errorMessage = ref<string | null>(null)
const input = ref<HTMLInputElement | null>(null)
let controller: AbortController | null = null

const importDump = useImportDump(() => props.database.id)
const uploading = computed(() => importDump.isPending.value)

const accept = computed(() => importAccept(props.database.type))
const extensions = computed(() => importExtensions(props.database.type).join(', '))
const fileAccepted = computed(
  () => !!file.value && isAcceptedImportFile(file.value.name, props.database.type),
)
const percent = computed(() =>
  total.value > 0 ? Math.min(100, Math.round((loaded.value / total.value) * 100)) : 0,
)
const canSubmit = computed(() => fileAccepted.value && confirmed.value && !uploading.value)

watch(open, (isOpen) => {
  if (isOpen) return
  file.value = null
  confirmed.value = false
  loaded.value = 0
  total.value = 0
  errorMessage.value = null
  if (input.value) input.value.value = ''
})

function onPick(e: Event) {
  const picked = (e.target as HTMLInputElement).files?.[0] ?? null
  file.value = picked
  errorMessage.value = null
  loaded.value = 0
  total.value = picked?.size ?? 0
}

async function onImport() {
  if (!file.value || !canSubmit.value) return
  errorMessage.value = null
  controller = new AbortController()
  try {
    await importDump.mutateAsync({
      file: file.value,
      signal: controller.signal,
      onProgress: (l, t) => {
        loaded.value = l
        total.value = t
      },
    })
    toast.success('Dump uploaded — restoring now')
    open.value = false
  } catch (err) {
    if (controller.signal.aborted) {
      toast.info('Import cancelled')
      open.value = false
    } else {
      errorMessage.value = importErrorMessage(err)
    }
  } finally {
    controller = null
  }
}

function onCancelUpload() {
  controller?.abort()
}

function onOpenChange(next: boolean) {
  if (!next && uploading.value) return
  open.value = next
}
</script>

<template>
  <Dialog :open="open" @update:open="onOpenChange">
    <DialogTrigger as-child>
      <Button size="sm" variant="outline" :disabled="disabled" :title="disabledReason">
        <FileUp />
        Import dump
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md" :show-close-button="!uploading">
      <DialogHeader>
        <DialogTitle>Import a dump</DialogTitle>
        <DialogDescription>
          Load an existing dump into
          <span class="font-mono text-foreground">{{ database.name }}</span
          >. It is kept as a snapshot, so it can be restored again later.
        </DialogDescription>
      </DialogHeader>

      <label
        class="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border px-4 py-4 transition-colors hover:border-muted-foreground/40"
        :class="{ 'pointer-events-none opacity-60': uploading }"
      >
        <input
          ref="input"
          type="file"
          class="sr-only"
          :accept="accept"
          :disabled="uploading"
          @change="onPick"
        />
        <Upload class="size-4 shrink-0 text-muted-foreground" />
        <span v-if="file" class="min-w-0 flex-1">
          <span class="block truncate font-mono text-sm text-foreground">{{ file.name }}</span>
          <span class="mt-0.5 block text-xs text-muted-foreground">{{
            formatBytes(file.size)
          }}</span>
        </span>
        <span v-else class="min-w-0 flex-1">
          <span class="block text-sm text-foreground">Choose a file</span>
          <span class="mt-0.5 block font-mono text-xs text-muted-foreground">{{ extensions }}</span>
        </span>
      </label>

      <p v-if="file && !fileAccepted" class="-mt-2 text-xs text-destructive">
        {{ database.type === 'MYSQL' ? 'MySQL' : 'Postgres' }} imports take {{ extensions }} files.
      </p>

      <div
        class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm"
      >
        <TriangleAlert class="mt-0.5 size-4 shrink-0 text-destructive" />
        <div class="space-y-3">
          <p class="text-foreground">
            This replaces all data in
            <span class="font-mono">{{ database.name }}</span
            >. Every existing table, view and routine is dropped before the dump loads. This cannot
            be undone.
          </p>
          <label class="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox
              :model-value="confirmed"
              :disabled="uploading"
              @update:model-value="(v) => (confirmed = v === true)"
            />
            I understand the current data will be lost
          </label>
        </div>
      </div>

      <div v-if="uploading" class="space-y-1.5">
        <div class="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            class="h-full rounded-full bg-primary transition-[width] duration-200"
            :style="{ width: `${percent}%` }"
          />
        </div>
        <p class="flex justify-between font-mono text-xs text-muted-foreground">
          <span>
            {{ percent < 100 ? `${formatBytes(loaded)} of ${formatBytes(total)}` : 'Storing…' }}
          </span>
          <span>{{ percent }}%</span>
        </p>
      </div>

      <p v-if="errorMessage" class="text-sm break-words text-destructive">{{ errorMessage }}</p>

      <DialogFooter>
        <Button v-if="uploading" variant="outline" @click="onCancelUpload">Cancel upload</Button>
        <Button v-else variant="outline" @click="open = false">Cancel</Button>
        <Button
          class="bg-destructive text-white hover:bg-destructive/90"
          :disabled="!canSubmit"
          @click="onImport"
        >
          <LoaderCircle v-if="uploading" class="animate-spin" />
          <FileUp v-else />
          Replace data
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

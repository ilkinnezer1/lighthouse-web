<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileCode, Info, LoaderCircle, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  useDeleteEnvironmentFile,
  useEnvironmentFiles,
  useSaveEnvironmentFile,
} from './environment-files.queries'
import { apiErrorMessage } from '@/lib/api'
import type { ManagedFile } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

const props = defineProps<{ envId: string }>()

const { data: files, isPending, isError } = useEnvironmentFiles(() => props.envId)
const save = useSaveEnvironmentFile(() => props.envId)
const del = useDeleteEnvironmentFile(() => props.envId)

const adding = ref(false)
const newPath = ref('')
const newContent = ref('')

const editingPath = ref<string | null>(null)
const editContent = ref('')

const pendingDelete = ref<ManagedFile | null>(null)

const busy = computed(() => save.isPending.value)

function startAdd() {
  editingPath.value = null
  adding.value = true
  newPath.value = ''
  newContent.value = ''
}

function cancelAdd() {
  adding.value = false
  newPath.value = ''
  newContent.value = ''
}

async function onAdd() {
  const path = newPath.value.trim()
  if (!path) {
    toast.error('Enter a relative file path, e.g. .env.local')
    return
  }
  try {
    await save.mutateAsync({ path, content: newContent.value })
    cancelAdd()
    toast.success(`Saved ${path}`, { description: 'Redeploy to apply.' })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save file'))
  }
}

function startEdit(file: ManagedFile) {
  adding.value = false
  editingPath.value = file.path
  editContent.value = file.content
}

function cancelEdit() {
  editingPath.value = null
  editContent.value = ''
}

async function saveEdit(path: string) {
  try {
    await save.mutateAsync({ path, content: editContent.value })
    editingPath.value = null
    toast.success(`Saved ${path}`, { description: 'Redeploy to apply.' })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save file'))
  }
}

async function confirmDelete() {
  const file = pendingDelete.value
  if (!file) return
  try {
    await del.mutateAsync(file.path)
    if (editingPath.value === file.path) cancelEdit()
    toast.success(`Removed ${file.path}`, { description: 'Redeploy to apply.' })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not delete file'))
  } finally {
    pendingDelete.value = null
  }
}
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-sm font-semibold tracking-tight text-foreground">
        Files
        <span v-if="files?.length" class="ml-1 text-muted-foreground/60">{{ files.length }}</span>
      </h2>
      <Button size="sm" variant="outline" :disabled="adding" @click="startAdd">
        <Plus />
        Add file
      </Button>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      Written into this environment's build context at deploy time — e.g.
      <span class="font-mono">.env.local</span>. Existing files at the same path are overwritten.
    </p>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-10 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load files.</p>

    <template v-else>
      <div
        v-if="files && files.length"
        class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        <div v-for="f in files" :key="f.path" class="bg-card">
          <div class="flex items-center gap-3 px-4 py-2.5">
            <FileCode class="size-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate font-mono text-sm text-foreground">{{ f.path }}</span>

            <template v-if="editingPath === f.path">
              <Button size="icon-sm" variant="ghost" title="Cancel" @click="cancelEdit">
                <X />
              </Button>
            </template>
            <template v-else>
              <Button size="icon-sm" variant="ghost" title="Edit" @click="startEdit(f)">
                <Pencil />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                class="text-muted-foreground hover:text-destructive"
                :disabled="del.isPending.value"
                title="Delete"
                @click="pendingDelete = f"
              >
                <Trash2 />
              </Button>
            </template>
          </div>

          <div v-if="editingPath === f.path" class="border-t border-border px-4 py-3">
            <Textarea
              v-model="editContent"
              rows="10"
              spellcheck="false"
              class="min-h-40 resize-y font-mono text-xs"
            />
            <div class="mt-3 flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" :disabled="busy" @click="cancelEdit">
                Cancel
              </Button>
              <Button size="sm" :disabled="busy" @click="saveEdit(f.path)">
                <LoaderCircle v-if="busy" class="animate-spin" />
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>

      <p
        v-else-if="!adding"
        class="mt-3 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground"
      >
        No files yet. Add one to overlay it onto each deploy.
      </p>

      <div v-if="adding" class="mt-3 rounded-xl border border-border bg-card px-4 py-3">
        <Input
          v-model="newPath"
          placeholder=".env.local"
          autofocus
          class="h-9 font-mono text-sm"
        />
        <Textarea
          v-model="newContent"
          rows="10"
          spellcheck="false"
          placeholder="DATABASE_URL=postgres://…&#10;NEXT_PUBLIC_API=https://…"
          class="mt-2 min-h-40 resize-y font-mono text-xs"
        />
        <div class="mt-3 flex items-center justify-end gap-2">
          <Button size="sm" variant="outline" :disabled="busy" @click="cancelAdd"> Cancel </Button>
          <Button size="sm" :disabled="!newPath.trim() || busy" @click="onAdd">
            <LoaderCircle v-if="busy" class="animate-spin" />
            <Plus v-else />
            Save file
          </Button>
        </div>
      </div>

      <p
        v-if="files && files.length"
        class="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground"
      >
        <Info class="size-3.5" />
        Redeploy to apply changes.
      </p>
    </template>

    <AlertDialog :open="!!pendingDelete" @update:open="(v) => !v && (pendingDelete = null)">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete file?</AlertDialogTitle>
          <AlertDialogDescription>
            <span class="font-mono">{{ pendingDelete?.path }}</span> will no longer be applied on the
            next deploy. This can't be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="del.isPending.value">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="del.isPending.value"
            @click="confirmDelete"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </section>
</template>

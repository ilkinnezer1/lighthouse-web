<script setup lang="ts">
import { computed, type ComponentPublicInstance, nextTick, ref, watch } from 'vue'
import { FilePlus, FileText, FolderTree, Info, LoaderCircle, Save, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useFileContent, useFileTree, useSaveEnvironmentFile } from './environment-files.queries'
import { buildFileTree } from './file-tree'
import FileTreeNode from './FileTreeNode.vue'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ envId: string }>()

const { data: tree, isPending, isError, refetch: refetchTree } = useFileTree(() => props.envId)
const save = useSaveEnvironmentFile(() => props.envId)

const selectedPath = ref<string | null>(null)
const { data: file, isFetching: contentLoading } = useFileContent(
  () => props.envId,
  selectedPath,
)

const nodes = computed(() => buildFileTree(tree.value?.entries ?? []))
const isEmpty = computed(() => !isPending.value && !isError.value && nodes.value.length === 0)

const draft = ref('')

// Seed the editor only when the loaded content matches the currently-selected file, and
// only once per selection — so a background refetch (e.g. the post-save invalidation) can't
// clobber an in-progress edit, and a stale response for a different file can't bleed in.
const draftFor = ref<string | null>(null)
const fileReady = computed(() => !!file.value && file.value.path === selectedPath.value)
const dirty = computed(
  () => fileReady.value && !file.value!.binary && draft.value !== file.value!.content,
)

watch(
  [file, selectedPath],
  () => {
    const f = file.value
    if (f && f.path === selectedPath.value && !f.binary && draftFor.value !== f.path) {
      draft.value = f.content
      draftFor.value = f.path
    }
  },
  { immediate: true },
)

function onSelect(path: string) {
  cancelCreate()
  selectedPath.value = path
}

async function onSave() {
  const path = selectedPath.value
  if (!path || !fileReady.value || file.value!.binary) return
  try {
    await save.mutateAsync({ path, content: draft.value })
    toast.success(`Saved ${path}`, { description: 'Redeploy to apply.' })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save file'))
  }
}

const creating = ref(false)
const newPath = ref('')
const newContent = ref('')
const pathInput = ref<ComponentPublicInstance | null>(null)

function startCreate(folder: string | null) {
  selectedPath.value = null
  creating.value = true
  newPath.value = folder ? `${folder}/` : ''
  newContent.value = ''
  void nextTick(() => {
    const el = pathInput.value?.$el as HTMLInputElement | undefined
    if (!el) return
    el.focus()
    const end = el.value.length
    el.setSelectionRange(end, end)
  })
}

function cancelCreate() {
  creating.value = false
  newPath.value = ''
  newContent.value = ''
}

function validatePath(path: string): string | null {
  if (!path) return 'Enter a file name.'
  if (path.startsWith('/')) return 'Path must be relative (no leading /).'
  if (path.endsWith('/')) return 'Enter a file name after the folder.'
  if (path.split('/').some((seg) => seg === '..' || seg === '.' || seg === ''))
    return 'Path can’t contain . or .. segments.'
  return null
}

async function onCreate() {
  const path = newPath.value.trim()
  const err = validatePath(path)
  if (err) {
    toast.error(err)
    return
  }
  try {
    await save.mutateAsync({ path, content: newContent.value })
    await refetchTree()
    creating.value = false
    selectedPath.value = path
    toast.success(`Saved ${path}`, { description: 'Redeploy to apply.' })
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not create file'))
  }
}
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-4">
      <div class="flex items-center gap-2">
        <FolderTree class="size-4 text-muted-foreground" />
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Explore files</h2>
      </div>
      <Button v-if="!isEmpty" size="sm" variant="outline" @click="startCreate(null)">
        <FilePlus />
        New file
      </Button>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      Browse the latest deploy's source. Edit a file to overlay it onto future deploys.
    </p>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 4" :key="n" class="h-7 w-full rounded-md" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load files.</p>

    <div
      v-else-if="tree?.noSource"
      class="mt-3 rounded-xl border border-dashed border-border py-12 text-center"
    >
      <FolderTree class="mx-auto size-5 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">
        This deployment has no source to browse.
      </p>
      <p class="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
        Prebuilt-image deploys skip the clone entirely, and an older deploy's files may have
        been cleaned up.
      </p>
    </div>

    <div
      v-else-if="isEmpty"
      class="mt-3 rounded-xl border border-dashed border-border py-12 text-center"
    >
      <FolderTree class="mx-auto size-5 text-muted-foreground" />
      <p class="mt-2 text-sm text-muted-foreground">
        Deploy this environment to browse its files.
      </p>
    </div>

    <div v-else class="mt-3 grid gap-4 lg:grid-cols-[minmax(0,18rem)_minmax(0,1fr)]">
      <div class="overflow-hidden rounded-xl border border-border bg-card">
        <div class="max-h-[28rem] overflow-y-auto py-1">
          <FileTreeNode
            v-for="node in nodes"
            :key="node.path"
            :node="node"
            :depth="0"
            :selected-path="selectedPath"
            @select="onSelect"
            @create="startCreate"
          />
        </div>
        <p
          v-if="tree?.truncated"
          class="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground"
        >
          Listing truncated — some files are hidden.
        </p>
      </div>

      <div class="overflow-hidden rounded-xl border border-border bg-card">
        <template v-if="creating">
          <div class="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <FilePlus class="size-4 shrink-0 text-muted-foreground" />
            <Input
              ref="pathInput"
              v-model="newPath"
              placeholder="config/packages/custom.yaml"
              spellcheck="false"
              class="h-8 flex-1 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0"
              @keydown.escape="cancelCreate"
            />
            <Button size="icon-sm" variant="ghost" title="Cancel" @click="cancelCreate">
              <X />
            </Button>
          </div>
          <div class="p-3">
            <Textarea
              v-model="newContent"
              rows="16"
              spellcheck="false"
              placeholder="File contents…"
              class="min-h-72 resize-y font-mono text-xs"
            />
            <div class="mt-3 flex items-center justify-end gap-2">
              <Button size="sm" variant="outline" :disabled="save.isPending.value" @click="cancelCreate">
                Cancel
              </Button>
              <Button size="sm" :disabled="!newPath.trim() || save.isPending.value" @click="onCreate">
                <LoaderCircle v-if="save.isPending.value" class="animate-spin" />
                <Save v-else />
                Create file
              </Button>
            </div>
          </div>
        </template>

        <div
          v-else-if="!selectedPath"
          class="flex h-full min-h-48 flex-col items-center justify-center px-4 py-12 text-center"
        >
          <FileText class="size-5 text-muted-foreground" />
          <p class="mt-2 text-sm text-muted-foreground">Select a file to view or edit it.</p>
        </div>

        <template v-else>
          <div class="flex items-center gap-2 border-b border-border px-4 py-2.5">
            <FileText class="size-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate font-mono text-xs text-foreground">{{ selectedPath }}</span>
            <Badge v-if="fileReady && file?.overridden" variant="secondary" class="text-[10px]">
              overridden
            </Badge>
          </div>

          <div v-if="contentLoading" class="space-y-2 p-4">
            <Skeleton v-for="n in 6" :key="n" class="h-3 w-full" />
          </div>

          <div
            v-else-if="fileReady && file?.binary"
            class="flex min-h-40 items-center justify-center px-4 py-12 text-center text-sm text-muted-foreground"
          >
            Binary file — not editable.
          </div>

          <template v-else-if="fileReady && file">
            <div class="p-3">
              <Textarea
                v-model="draft"
                rows="16"
                spellcheck="false"
                class="min-h-72 resize-y font-mono text-xs"
              />
              <p
                v-if="file.truncated"
                class="mt-2 inline-flex items-center gap-1.5 text-[11px] text-amber-500"
              >
                <Info class="size-3.5" />
                File truncated — saving will overwrite the full file with this content.
              </p>
              <div class="mt-3 flex items-center justify-between gap-2">
                <p
                  v-if="file.overridden"
                  class="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
                >
                  <Info class="size-3.5" />
                  Redeploy to apply changes.
                </p>
                <span v-else />
                <Button size="sm" :disabled="!dirty || save.isPending.value" @click="onSave">
                  <LoaderCircle v-if="save.isPending.value" class="animate-spin" />
                  <Save v-else />
                  Save
                </Button>
              </div>
            </div>
          </template>
        </template>
      </div>
    </div>
  </section>
</template>

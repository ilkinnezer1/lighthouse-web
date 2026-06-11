<script setup lang="ts">
import { ref } from 'vue'
import { Check, FileText, LoaderCircle, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDeleteEnvVar, useEnvVars, useMergeEnvVars } from './env-vars.queries'
import PasteEnvDialog from './PasteEnvDialog.vue'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'

const props = defineProps<{ envId: string }>()

const KEY_RE = /^[A-Za-z_][A-Za-z0-9_]*$/

const { data: vars, isPending, isError } = useEnvVars(() => props.envId)
const merge = useMergeEnvVars(() => props.envId)
const del = useDeleteEnvVar(() => props.envId)

const newKey = ref('')
const newValue = ref('')
const editingKey = ref<string | null>(null)
const editValue = ref('')
const showPaste = ref(false)

async function onAdd() {
  const key = newKey.value.trim()
  if (!KEY_RE.test(key)) {
    toast.error('Invalid name — letters, digits and _ only, not starting with a digit')
    return
  }
  try {
    await merge.mutateAsync({ vars: { [key]: newValue.value } })
    newKey.value = ''
    newValue.value = ''
    toast.success(`Saved ${key}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save variable'))
  }
}

function startEdit(key: string) {
  editingKey.value = key
  editValue.value = ''
}

function cancelEdit() {
  editingKey.value = null
  editValue.value = ''
}

async function saveEdit(key: string) {
  try {
    await merge.mutateAsync({ vars: { [key]: editValue.value } })
    editingKey.value = null
    toast.success(`Updated ${key}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not save variable'))
  }
}

async function onDelete(key: string) {
  try {
    await del.mutateAsync(key)
    toast.success(`Removed ${key}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not delete variable'))
  }
}
</script>

<template>
  <section>
    <div class="flex items-center justify-between gap-4">
      <h2 class="text-sm font-semibold tracking-tight text-foreground">
        Environment variables
        <span v-if="vars?.length" class="ml-1 text-muted-foreground/60">{{ vars.length }}</span>
      </h2>
      <Button size="sm" variant="outline" @click="showPaste = true">
        <FileText />
        Paste .env
      </Button>
    </div>
    <p class="mt-1 text-xs text-muted-foreground">
      Injected into this environment's containers at deploy time. Values are write-only — to change
      one, retype it.
    </p>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-10 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load variables.</p>

    <template v-else>
      <div
        v-if="vars && vars.length"
        class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
      >
        <div v-for="v in vars" :key="v.key" class="flex items-center gap-3 bg-card px-4 py-2.5">
          <span class="w-1/3 shrink-0 truncate font-mono text-sm text-foreground">{{ v.key }}</span>

          <template v-if="editingKey === v.key">
            <Input
              v-model="editValue"
              placeholder="New value"
              autofocus
              class="h-8 flex-1 font-mono text-xs"
              @keyup.enter="saveEdit(v.key)"
              @keyup.esc="cancelEdit"
            />
            <Button
              size="icon-sm"
              variant="ghost"
              :disabled="merge.isPending.value"
              title="Save"
              @click="saveEdit(v.key)"
            >
              <Check />
            </Button>
            <Button size="icon-sm" variant="ghost" title="Cancel" @click="cancelEdit">
              <X />
            </Button>
          </template>

          <template v-else>
            <span class="flex-1 truncate font-mono text-xs text-muted-foreground">{{ v.value }}</span>
            <Button size="icon-sm" variant="ghost" title="Change value" @click="startEdit(v.key)">
              <Pencil />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              class="text-muted-foreground hover:text-destructive"
              :disabled="del.isPending.value"
              title="Delete"
              @click="onDelete(v.key)"
            >
              <Trash2 />
            </Button>
          </template>
        </div>
      </div>

      <p v-else class="mt-3 rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
        No variables yet. Add one below or paste a .env file.
      </p>

      <div class="mt-3 flex items-center gap-2">
        <Input
          v-model="newKey"
          placeholder="KEY"
          class="h-9 w-1/3 font-mono text-sm"
          @keyup.enter="onAdd"
        />
        <Input
          v-model="newValue"
          placeholder="value"
          class="h-9 flex-1 font-mono text-xs"
          @keyup.enter="onAdd"
        />
        <Button size="sm" :disabled="!newKey.trim() || merge.isPending.value" @click="onAdd">
          <LoaderCircle v-if="merge.isPending.value" class="animate-spin" />
          <Plus v-else />
          Add
        </Button>
      </div>
    </template>

    <PasteEnvDialog v-model:open="showPaste" :env-id="envId" />
  </section>
</template>

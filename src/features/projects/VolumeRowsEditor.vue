<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import type { VolumeRow } from './useBuildConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const rows = defineModel<VolumeRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, { name: '', path: '' }]
}
function removeRow(i: number) {
  rows.value = rows.value.filter((_, n) => n !== i)
}
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <Label>Persistent volumes</Label>
      <Button type="button" variant="ghost" size="sm" @click="addRow">
        <Plus />
        Add
      </Button>
    </div>
    <p class="text-xs text-muted-foreground">
      Data written here survives redeploys. Without a volume, anything the container writes is lost
      the next time you deploy.
    </p>
    <div v-if="rows.length === 0" class="text-xs text-muted-foreground">No volumes.</div>
    <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-2">
      <Input v-model="row.name" placeholder="uploads" class="w-1/3 font-mono text-sm" />
      <Input
        v-model="row.path"
        placeholder="/app/storage/uploads"
        class="flex-1 font-mono text-sm"
      />
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="shrink-0 text-muted-foreground"
        title="Remove"
        @click="removeRow(i)"
      >
        <X />
      </Button>
    </div>
  </div>
</template>

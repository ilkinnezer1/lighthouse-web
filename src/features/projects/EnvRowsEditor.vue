<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import type { EnvRow } from './useBuildConfigForm'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const rows = defineModel<EnvRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, { key: '', value: '' }]
}
function removeRow(i: number) {
  rows.value = rows.value.filter((_, n) => n !== i)
}
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <Label>Environment variables</Label>
      <Button type="button" variant="ghost" size="sm" @click="addRow">
        <Plus />
        Add
      </Button>
    </div>
    <div v-if="rows.length === 0" class="text-xs text-muted-foreground">No variables set.</div>
    <div v-for="(row, i) in rows" :key="i" class="flex items-center gap-2">
      <Input v-model="row.key" placeholder="KEY" class="font-mono text-sm" />
      <Input v-model="row.value" placeholder="value" class="font-mono text-sm" />
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

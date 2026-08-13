<script setup lang="ts">
import { Plus, X } from '@lucide/vue'
import type { MaintRow } from './useBuildConfigForm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const rows = defineModel<MaintRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, { id: '', label: '', service: '', command: '', destructive: false }]
}
function removeRow(i: number) {
  rows.value = rows.value.filter((_, n) => n !== i)
}
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <Label>Maintenance actions</Label>
      <Button type="button" variant="ghost" size="sm" @click="addRow">
        <Plus />
        Add
      </Button>
    </div>
    <p class="text-xs text-muted-foreground">
      One-click commands shown on each deployment. The command runs in the named service's live
      container; the value stays server-side and is never sent to the browser.
    </p>
    <div v-if="rows.length === 0" class="text-xs text-muted-foreground">No actions set.</div>
    <div v-for="(row, i) in rows" :key="i" class="grid gap-2 rounded-lg border border-border p-3">
      <div class="flex items-center gap-2">
        <Input v-model="row.label" placeholder="Label (e.g. Run migrations)" class="text-sm" />
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
      <Input v-model="row.service" placeholder="service (e.g. web)" class="font-mono text-sm" />
      <Input
        v-model="row.command"
        placeholder="command (e.g. php artisan migrate --force)"
        class="font-mono text-sm"
      />
      <label class="flex items-center gap-2 text-xs text-muted-foreground">
        <Checkbox v-model="row.destructive" />
        Confirm before running (destructive)
      </label>
    </div>
  </div>
</template>

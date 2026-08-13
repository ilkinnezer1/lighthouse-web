<script setup lang="ts">
import { ChevronDown, ChevronUp, Plus, X } from '@lucide/vue'
import type { SetupRow } from './useBuildConfigForm'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const rows = defineModel<SetupRow[]>({ required: true })

function addRow() {
  rows.value = [...rows.value, { command: '', image: '', docker: false, advanced: false }]
}
function removeRow(i: number) {
  rows.value = rows.value.filter((_, n) => n !== i)
}
function moveRow(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= rows.value.length) return
  const next = [...rows.value]
  ;[next[i], next[j]] = [next[j], next[i]]
  rows.value = next
}
</script>

<template>
  <div class="grid gap-2">
    <div class="flex items-center justify-between">
      <Label>Setup steps</Label>
      <Button type="button" variant="ghost" size="sm" @click="addRow">
        <Plus />
        Add
      </Button>
    </div>
    <p class="text-xs text-muted-foreground">
      Runs after clone, before build, with your environment variables and files available. A failed
      step fails the deploy.
    </p>
    <div v-if="rows.length === 0" class="text-xs text-muted-foreground">No setup steps.</div>
    <div v-for="(row, i) in rows" :key="i" class="grid gap-2 rounded-lg border border-border p-3">
      <div class="flex items-center gap-2">
        <div class="flex shrink-0 flex-col">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="size-5 text-muted-foreground"
            title="Move up"
            :disabled="i === 0"
            @click="moveRow(i, -1)"
          >
            <ChevronUp />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            class="size-5 text-muted-foreground"
            title="Move down"
            :disabled="i === rows.length - 1"
            @click="moveRow(i, 1)"
          >
            <ChevronDown />
          </Button>
        </div>
        <Input v-model="row.command" placeholder="make setup" class="font-mono text-sm" />
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
      <button
        type="button"
        class="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
        @click="row.advanced = !row.advanced"
      >
        {{ row.advanced ? 'Hide advanced' : 'Advanced' }}
      </button>
      <div v-if="row.advanced" class="grid gap-2 pl-1">
        <Input
          v-model="row.image"
          placeholder="image with your script's tools, default alpine"
          class="font-mono text-sm"
        />
        <label class="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox v-model="row.docker" />
          Script needs Docker
        </label>
      </div>
    </div>
  </div>
</template>

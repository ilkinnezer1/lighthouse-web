<script setup lang="ts">
import { computed } from 'vue'
import { STRATEGIES, type StrategyChoice } from './useBuildConfigForm'
import { Label } from '@/components/ui/label'

const strategy = defineModel<StrategyChoice>({ required: true })

const hint = computed(() => STRATEGIES.find((s) => s.value === strategy.value)?.hint ?? '')
</script>

<template>
  <div class="grid gap-2">
    <Label>Build method</Label>
    <div class="grid grid-cols-2 gap-2">
      <button
        v-for="s in STRATEGIES"
        :key="s.value"
        type="button"
        :class="[
          'rounded-lg border px-3 py-2 text-sm transition-colors',
          strategy === s.value
            ? 'border-primary bg-primary/10 text-foreground'
            : 'border-border text-muted-foreground hover:border-muted-foreground/40',
        ]"
        @click="strategy = s.value"
      >
        {{ s.label }}
      </button>
    </div>
    <p class="text-xs text-muted-foreground">{{ hint }}</p>
  </div>
</template>

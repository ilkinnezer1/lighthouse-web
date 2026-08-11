<script setup lang="ts">
/**
 * Page-level tabs in the editorial language: eyebrow labels on the same hairline
 * every section head uses, with the active one marked by a rule in the beacon
 * amber rather than a filled pill.
 *
 * Dumb by design — the page owns which tab is active, so it can keep that in the
 * URL and hand out linkable tabs.
 */
interface SectionTab {
  key: string
  label: string
  count?: number | null
}

defineProps<{ tabs: SectionTab[] }>()
const active = defineModel<string>({ required: true })
</script>

<template>
  <!-- Wraps rather than scrolls: the global thin-scrollbar rule paints a track
       on any scroll container, and a handful of tabs never needs one. -->
  <div class="flex flex-wrap items-stretch gap-x-6 border-b border-rule">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="-mb-px flex shrink-0 items-baseline gap-2 border-b-2 pb-2 transition-colors"
      :class="t.key === active ? 'border-primary' : 'border-transparent hover:border-rule'"
      :aria-current="t.key === active ? 'page' : undefined"
      @click="active = t.key"
    >
      <span class="eyebrow" :class="t.key === active ? 'text-ink-1' : ''">{{ t.label }}</span>
      <span v-if="t.count !== undefined && t.count !== null" class="font-mono text-xs text-ink-4">
        {{ t.count }}
      </span>
    </button>
  </div>
</template>

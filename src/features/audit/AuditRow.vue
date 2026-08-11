<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ChevronRight } from '@lucide/vue'
import { actionBadgeClass, actionTone, resourceRoute, shortId } from './audit.format'
import { clockTime } from '@/lib/time'
import type { AuditRow } from '@/types/api'

const props = defineProps<{ row: AuditRow }>()

const open = ref(false)

const actor = computed(() => props.row.actor?.email ?? 'system')
const tone = computed(() => actionTone(props.row.action))
const route = computed(() => resourceRoute(props.row.resourceType, props.row.resourceId))
const resourceShort = computed(() => shortId(props.row.resourceId))
const pretty = computed(() =>
  props.row.afterJson ? JSON.stringify(props.row.afterJson, null, 2) : null,
)
</script>

<template>
  <div class="border-b border-border bg-card last:border-b-0">
    <button
      type="button"
      class="group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent/40"
      @click="open = !open"
    >
      <ChevronRight
        class="size-3.5 shrink-0 text-muted-foreground/50 transition-transform"
        :class="open && 'rotate-90'"
      />

      <span class="w-12 shrink-0 font-mono text-xs text-muted-foreground/60">
        {{ clockTime(row.createdAt) }}
      </span>

      <span
        class="shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] leading-none"
        :class="actionBadgeClass[tone]"
      >
        {{ row.action }}
      </span>

      <span
        class="shrink-0 truncate text-sm"
        :class="row.actor ? 'text-foreground/90' : 'italic text-muted-foreground/70'"
      >
        {{ actor }}
      </span>

      <span class="min-w-0 flex-1 truncate text-sm text-muted-foreground">
        <template v-if="row.resourceType">
          {{ row.resourceType }}
          <RouterLink
            v-if="route && resourceShort"
            :to="route"
            class="font-mono text-xs text-primary/80 hover:text-primary hover:underline"
            @click.stop
          >
            {{ resourceShort }}
          </RouterLink>
          <span v-else-if="resourceShort" class="font-mono text-xs text-muted-foreground/70">
            {{ resourceShort }}
          </span>
        </template>
      </span>

      <span
        v-if="row.ip"
        class="hidden shrink-0 font-mono text-xs text-muted-foreground/50 md:inline"
      >
        {{ row.ip }}
      </span>
    </button>

    <div v-if="open" class="border-t border-border/60 bg-background/40 px-4 py-3">
      <dl class="mb-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <dt class="text-muted-foreground/60">Event ID</dt>
        <dd class="font-mono text-muted-foreground">{{ row.id }}</dd>
        <template v-if="row.resourceId">
          <dt class="text-muted-foreground/60">Resource</dt>
          <dd class="font-mono text-muted-foreground">
            {{ row.resourceType }} · {{ row.resourceId }}
          </dd>
        </template>
        <template v-if="row.userAgent">
          <dt class="text-muted-foreground/60">User agent</dt>
          <dd class="truncate font-mono text-muted-foreground/80">{{ row.userAgent }}</dd>
        </template>
      </dl>

      <pre
        v-if="pretty"
        class="overflow-x-auto rounded-md border border-border bg-card p-3 font-mono text-xs leading-relaxed text-foreground/90"
        >{{ pretty }}</pre>
      <p v-else class="text-xs italic text-muted-foreground/60">No payload recorded.</p>
    </div>
  </div>
</template>

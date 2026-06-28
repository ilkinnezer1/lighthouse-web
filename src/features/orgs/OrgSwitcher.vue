<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { onClickOutside } from '@vueuse/core'
import { Building2, Check, ChevronsUpDown, Plus, Settings } from '@lucide/vue'
import { useActiveOrg } from './useActiveOrg'
import { ROLE_BADGE, ROLE_LABEL } from './roles'
import CreateOrgDialog from './CreateOrgDialog.vue'
import type { Organization } from '@/types/api'
import { Badge } from '@/components/ui/badge'

const router = useRouter()
const { orgs, activeOrg, activeOrgId, setActiveOrg } = useActiveOrg()

const root = ref<HTMLElement | null>(null)
const open = ref(false)
const showCreate = ref(false)

onClickOutside(root, () => (open.value = false))

function select(org: Organization) {
  setActiveOrg(org.id)
  open.value = false
}

function openSettings() {
  if (!activeOrg.value) return
  open.value = false
  router.push(`/orgs/${activeOrg.value.id}/settings`)
}

function onCreated(org: { id: string }) {
  setActiveOrg(org.id)
}

// Highlight the personal org as active when nothing is explicitly chosen.
function isActive(org: Organization) {
  return activeOrgId.value ? org.id === activeOrgId.value : org.isPersonal
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-md border border-border bg-card px-2.5 py-2 text-left text-sm transition-colors hover:bg-accent"
      @click="open = !open"
    >
      <Building2 class="size-4 shrink-0 text-muted-foreground" />
      <span class="min-w-0 flex-1 truncate font-medium text-foreground">
        {{ activeOrg?.name ?? 'Loading…' }}
      </span>
      <ChevronsUpDown class="size-4 shrink-0 text-muted-foreground" />
    </button>

    <div
      v-if="open"
      class="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border border-border bg-popover p-1 shadow-lg"
    >
      <p class="px-2 py-1.5 text-xs font-medium text-muted-foreground">Organizations</p>
      <button
        v-for="org in orgs ?? []"
        :key="org.id"
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent"
        @click="select(org)"
      >
        <Check
          class="size-3.5 shrink-0"
          :class="isActive(org) ? 'text-primary' : 'text-transparent'"
        />
        <span class="min-w-0 flex-1 truncate text-foreground">{{ org.name }}</span>
        <Badge :variant="ROLE_BADGE[org.role]" class="shrink-0 text-[10px]">
          {{ ROLE_LABEL[org.role] }}
        </Badge>
      </button>

      <div class="my-1 h-px bg-border" />

      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="openSettings"
      >
        <Settings class="size-3.5" />
        Organization settings
      </button>
      <button
        type="button"
        class="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        @click="open = false; showCreate = true"
      >
        <Plus class="size-3.5" />
        Create organization
      </button>
    </div>

    <CreateOrgDialog v-model:open="showCreate" @created="onCreated" />
  </div>
</template>

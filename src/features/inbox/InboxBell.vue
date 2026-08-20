<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { onClickOutside, onKeyStroke } from '@vueuse/core'
import { Bell } from '@lucide/vue'
import { useMyInvitations } from '@/features/invitations/invitations.queries'
import { useNotificationFeed } from './inbox.queries'
import { useInboxLive } from './useInboxLive'
import InboxPanel from './InboxPanel.vue'

// Mounted here rather than in the panel: the count has to stay right and the
// toasts have to fire while the tray is shut, which is nearly always.
useInboxLive()

const feed = useNotificationFeed()
const { data: invitations } = useMyInvitations()
const route = useRoute()

// One tray, two sources. Invitations keep their own endpoint and lifecycle;
// what they share is the bell.
const count = computed(() => feed.unreadCount.value + (invitations.value?.length ?? 0))
const badge = computed(() => (count.value > 9 ? '9+' : String(count.value)))

const root = ref<HTMLElement | null>(null)
const open = ref(false)
onClickOutside(root, () => (open.value = false))
onKeyStroke('Escape', () => (open.value = false))
watch(
  () => route.fullPath,
  () => (open.value = false),
)
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative flex size-8 items-center justify-center rounded-md text-ink-3 transition-colors hover:bg-accent hover:text-ink-1"
      :aria-label="count ? `Inbox, ${count} needing attention` : 'Inbox'"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Bell class="size-4" />
      <span
        v-if="count"
        class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[0.5625rem] font-medium text-primary-foreground"
      >
        {{ badge }}
      </span>
    </button>

    <InboxPanel
      v-if="open"
      class="absolute right-0 top-full z-30 mt-1.5"
      @navigate="open = false"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { CheckCheck, LoaderCircle } from '@lucide/vue'
import { useNowMs } from '@/lib/clock'
import { shortAgo } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import { useMyInvitations } from '@/features/invitations/invitations.queries'
import { groupNotifications, type InboxGroup } from './inbox.group'
import { notificationHeadline, notificationMeta } from './inbox.format'
import { useMarkAllRead, useMarkRead, useNotificationFeed } from './inbox.queries'
import InboxRow from './InboxRow.vue'
import InboxInvitationRow from './InboxInvitationRow.vue'

const emit = defineEmits<{ navigate: [] }>()

// One subscription for the whole panel — the rows read `now` as a prop rather
// than each joining the clock.
const now = useNowMs()

const feed = useNotificationFeed()
const { data: invitations } = useMyInvitations()
const markRead = useMarkRead()
const markAllRead = useMarkAllRead()

const groups = computed(() => groupNotifications(feed.items.value))
const invites = computed(() => invitations.value ?? [])
const isEmpty = computed(
  () => !feed.isPending.value && groups.value.length === 0 && invites.value.length === 0,
)

const expanded = ref(new Set<string>())

function metaFor(group: InboxGroup): string {
  return notificationMeta(group.items[0], shortAgo(group.createdAt, now.value))
}

function idsOf(group: InboxGroup): string[] {
  return group.items.filter((n) => !n.readAt).map((n) => n.id)
}

function read(group: InboxGroup) {
  const ids = idsOf(group)
  if (ids.length) markRead.mutate(ids)
}

function onSelect(group: InboxGroup) {
  read(group)
  emit('navigate')
}

function onToggle(group: InboxGroup) {
  const next = new Set(expanded.value)
  if (next.has(group.id)) next.delete(group.id)
  else {
    next.add(group.id)
    // Expanding is reading — the headlines are now on screen.
    read(group)
  }
  expanded.value = next
}
</script>

<template>
  <div
    class="w-[min(23rem,calc(100vw-1.5rem))] overflow-hidden rounded-lg border border-rule bg-popover shadow-lg"
  >
    <header class="flex h-9 items-center justify-between gap-2 border-b border-rule px-3">
      <p class="eyebrow">Inbox</p>
      <button
        v-if="feed.unreadCount.value > 0"
        type="button"
        class="inline-flex items-center gap-1.5 text-xs text-ink-3 transition-colors hover:text-ink-1"
        @click="markAllRead.mutate()"
      >
        <CheckCheck class="size-3.5" />
        Mark all read
      </button>
    </header>

    <div class="max-h-[26rem] overflow-y-auto overscroll-contain">
      <section v-if="invites.length">
        <p class="eyebrow bg-sunken px-3 py-1.5">Invitations</p>
        <ul class="rule-y">
          <InboxInvitationRow v-for="inv in invites" :key="inv.id" :invitation="inv" :now="now" />
        </ul>
      </section>

      <div v-if="feed.isPending.value" class="space-y-3 px-3 py-4" aria-busy="true">
        <div v-for="i in 3" :key="i" class="flex items-start gap-2.5">
          <div class="mt-0.5 size-4 shrink-0 animate-pulse rounded-full bg-sunken" />
          <div class="min-w-0 flex-1 space-y-1.5">
            <div class="h-3.5 w-3/4 animate-pulse rounded bg-sunken" />
            <div class="h-2.5 w-2/5 animate-pulse rounded bg-sunken" />
          </div>
        </div>
        <span class="sr-only">Loading notifications…</span>
      </div>

      <p
        v-else-if="feed.isError.value"
        role="alert"
        class="px-3 py-6 text-center text-sm text-destructive"
      >
        {{ apiErrorMessage(feed.error.value, 'Could not load your inbox') }}
      </p>

      <!--
        A new user's inbox is empty until something happens TO THEM, which may be
        never. It has to read as "nothing needs you", and saying what would
        appear here is what stops it reading as broken.
      -->
      <div v-else-if="isEmpty" class="relative overflow-hidden px-6 py-10 text-center">
        <div
          class="pointer-events-none absolute inset-0 opacity-[0.55]"
          style="
            background-image: radial-gradient(currentColor 1px, transparent 1px);
            background-size: 14px 14px;
            color: var(--ink-4);
            mask-image: radial-gradient(ellipse 70% 60% at 50% 50%, transparent 30%, black 100%);
          "
        />
        <div class="relative">
          <p class="display text-base">Nothing needs you</p>
          <p class="mx-auto mt-1 max-w-[15rem] text-xs leading-relaxed text-ink-3">
            Deploys you start, locks you hold and databases you own report here when something
            happens to them.
          </p>
        </div>
      </div>

      <ul v-else class="rule-y">
        <li v-for="group in groups" :key="group.id">
          <RouterLink
            v-if="group.link"
            :to="group.link"
            class="block hover:bg-accent/60"
            @click="onSelect(group)"
          >
            <InboxRow
              :kind="group.kind"
              :headline="group.headline"
              :detail="group.items.length === 1 ? group.items[0].body : null"
              :meta="metaFor(group)"
              :unread="group.unread"
            />
          </RouterLink>

          <button
            v-else-if="group.items.length > 1"
            type="button"
            class="block w-full hover:bg-accent/60"
            :aria-expanded="expanded.has(group.id)"
            @click="onToggle(group)"
          >
            <InboxRow
              :kind="group.kind"
              :headline="group.headline"
              :meta="metaFor(group)"
              :unread="group.unread"
              :count="group.items.length"
              expandable
              :expanded="expanded.has(group.id)"
            />
          </button>

          <!-- No link and nothing to expand: still worth showing, just inert. -->
          <InboxRow
            v-else
            :kind="group.kind"
            :headline="group.headline"
            :detail="group.items.length === 1 ? group.items[0].body : null"
            :meta="metaFor(group)"
            :unread="group.unread"
          />

          <ul v-if="expanded.has(group.id)" class="rule-y border-t border-rule">
            <li v-for="item in group.items" :key="item.id">
              <RouterLink
                v-if="item.link"
                :to="item.link"
                class="block hover:bg-accent/60"
                @click="emit('navigate')"
              >
                <InboxRow
                  nested
                  :kind="item.kind"
                  :headline="notificationHeadline(item)"
                  :detail="item.body"
                  :meta="notificationMeta(item, shortAgo(item.createdAt, now))"
                  :unread="!item.readAt"
                />
              </RouterLink>
              <InboxRow
                v-else
                nested
                :kind="item.kind"
                :headline="notificationHeadline(item)"
                :detail="item.body"
                :meta="notificationMeta(item, shortAgo(item.createdAt, now))"
                :unread="!item.readAt"
              />
            </li>
          </ul>
        </li>
      </ul>

      <button
        v-if="feed.hasNextPage.value"
        type="button"
        class="flex w-full items-center justify-center gap-1.5 border-t border-rule py-2 text-xs text-ink-3 transition-colors hover:bg-accent/60 hover:text-ink-1 disabled:opacity-50"
        :disabled="feed.isFetchingNextPage.value"
        @click="feed.fetchNextPage()"
      >
        <LoaderCircle v-if="feed.isFetchingNextPage.value" class="size-3.5 animate-spin" />
        {{ feed.isFetchingNextPage.value ? 'Loading…' : 'Older' }}
      </button>
    </div>
  </div>
</template>

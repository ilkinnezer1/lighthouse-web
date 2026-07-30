<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router'
import {
  Database,
  FolderGit2,
  LogOut,
  Menu,
  Moon,
  Plug,
  Rocket,
  ScrollText,
  Timer,
  Search,
  Sun,
  X,
} from '@lucide/vue'
import Logo from '@/components/Logo.vue'
import CommandPalette from '@/components/CommandPalette.vue'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/lib/theme'
import { useAuthStore } from '@/features/auth/auth.store'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { useCan } from '@/features/orgs/useCan'
import OrgSwitcher from '@/features/orgs/OrgSwitcher.vue'
import InvitationsInbox from '@/features/invitations/InvitationsInbox.vue'

const auth = useAuthStore()
const activeOrg = useActiveOrgStore()
const router = useRouter()
const route = useRoute()
const { isDark, toggle: toggleTheme } = useTheme()

const palette = ref<InstanceType<typeof CommandPalette> | null>(null)
const navOpen = ref(false)
// Never leave the drawer covering the page the user just navigated to.
watch(() => route.fullPath, () => { navOpen.value = false })

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)

// The activity feed is Admin+ on the server (Members/Viewers get 403) — hide it.
const canSeeAudit = useCan('audit.read')

const initial = computed(() => {
  const base = auth.user?.displayName || auth.user?.username || auth.user?.email || '?'
  return base.charAt(0).toUpperCase()
})

async function onLogout() {
  await auth.logout()
  // Clear the persisted scope so the next user never inherits it.
  activeOrg.reset()
  await router.replace({ name: 'login' })
}

// Active state is a left marker + ink step, not a filled pill — the pill is the
// single loudest "stock component" tell in the whole shell.
const navBase =
  'group relative flex items-center gap-3 py-1.5 pl-4 pr-3 text-sm transition-colors ' +
  'before:absolute before:left-0 before:top-1/2 before:h-4 before:w-px before:-translate-y-1/2 ' +
  'before:bg-transparent before:transition-colors text-ink-3 hover:text-ink-1 hover:before:bg-ink-4'
const navActive = 'text-ink-1! before:bg-primary! before:h-5!'

const nav = [
  { to: '/', label: 'Projects', icon: FolderGit2, exact: true },
  { to: '/deployments', label: 'Deployments', icon: Rocket, exact: false },
  { to: '/scheduled-tasks', label: 'Scheduled tasks', icon: Timer, exact: false },
  { to: '/databases', label: 'Databases', icon: Database, exact: false },
  { to: '/integrations', label: 'Integrations', icon: Plug, exact: false },
]
</script>

<template>
  <div class="min-h-svh lg:grid lg:grid-cols-[14.5rem_1fr]">
    <!-- Drawer scrim on small screens; the sidebar is a fixed panel below lg. -->
    <div
      v-if="navOpen"
      class="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] lg:hidden"
      @click="navOpen = false"
    />

    <aside
      class="fixed inset-y-0 left-0 z-40 flex w-[14.5rem] flex-col border-r border-rule bg-sidebar transition-transform lg:static lg:translate-x-0"
      :class="navOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="flex h-14 items-center justify-between px-5">
        <Logo :size="24" />
        <Button
          variant="ghost"
          size="icon-sm"
          class="lg:hidden"
          aria-label="Close navigation"
          @click="navOpen = false"
        >
          <X />
        </Button>
      </div>

      <div class="px-4 pb-4">
        <OrgSwitcher />
      </div>

      <nav class="flex-1 px-4">
        <p class="eyebrow mb-2.5 pl-4">Workspace</p>
        <div class="space-y-0.5">
          <RouterLink
            v-for="item in nav"
            :key="item.to"
            :to="item.to"
            :class="navBase"
            :exact-active-class="item.exact ? navActive : undefined"
            :active-class="item.exact ? undefined : navActive"
          >
            <component :is="item.icon" class="size-4 shrink-0 text-ink-4 group-hover:text-ink-3" />
            {{ item.label }}
          </RouterLink>
        </div>

        <template v-if="canSeeAudit">
          <p class="eyebrow mb-2.5 mt-7 pl-4">Audit</p>
          <RouterLink to="/audit" :class="navBase" :active-class="navActive">
            <ScrollText class="size-4 shrink-0 text-ink-4 group-hover:text-ink-3" />
            Activity
          </RouterLink>
        </template>
      </nav>

      <div class="border-t border-rule px-4 py-3">
        <div class="flex items-center gap-3">
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/12 font-mono text-xs font-medium text-primary"
          >
            {{ initial }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm text-ink-1">
              {{ auth.user?.displayName || auth.user?.username }}
            </p>
            <p class="truncate font-mono text-[0.6875rem] text-ink-4">{{ auth.user?.email }}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            title="Sign out"
            aria-label="Sign out"
            @click="onLogout"
          >
            <LogOut />
          </Button>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      <header class="flex h-14 shrink-0 items-center gap-2 border-b border-rule px-4 sm:px-6">
        <Button
          variant="ghost"
          size="icon-sm"
          class="lg:hidden"
          aria-label="Open navigation"
          @click="navOpen = true"
        >
          <Menu />
        </Button>

        <!-- Search is discoverable, not just a shortcut nobody knows about. -->
        <button
          type="button"
          class="flex h-8 min-w-0 items-center gap-2 rounded-md border border-rule px-2.5 text-sm text-ink-4 transition-colors hover:border-ink-4 hover:text-ink-2 sm:w-64"
          @click="palette?.show()"
        >
          <Search class="size-3.5 shrink-0" aria-hidden="true" />
          <span class="hidden truncate sm:inline">Search…</span>
          <kbd
            class="ml-auto hidden shrink-0 rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] sm:inline"
          >
            {{ isMac ? '⌘' : 'Ctrl ' }}K
          </kbd>
        </button>

        <div class="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            :title="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            :aria-label="isDark ? 'Switch to light theme' : 'Switch to dark theme'"
            @click="toggleTheme"
          >
            <Sun v-if="isDark" />
            <Moon v-else />
          </Button>
          <InvitationsInbox />
        </div>
      </header>
      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>

    <CommandPalette ref="palette" />
  </div>
</template>

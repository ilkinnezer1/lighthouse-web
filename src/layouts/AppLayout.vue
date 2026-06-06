<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { Database, FolderGit2, LogOut, Rocket } from '@lucide/vue'
import Logo from '@/components/Logo.vue'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/features/auth/auth.store'

const auth = useAuthStore()
const router = useRouter()

const initial = computed(() => {
  const base = auth.user?.displayName || auth.user?.username || auth.user?.email || '?'
  return base.charAt(0).toUpperCase()
})

async function onLogout() {
  await auth.logout()
  await router.replace({ name: 'login' })
}

const navBase =
  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors'
</script>

<template>
  <div class="grid min-h-svh grid-cols-[15rem_1fr]">
    <aside class="flex flex-col border-r border-border bg-sidebar">
      <div class="flex h-14 items-center px-5">
        <Logo :size="26" />
      </div>

      <nav class="flex-1 space-y-1 px-3 py-2">
        <RouterLink
          to="/"
          :class="[navBase, 'text-muted-foreground hover:bg-accent hover:text-foreground']"
          exact-active-class="bg-accent! text-foreground!"
        >
          <FolderGit2 class="size-4" />
          Projects
        </RouterLink>

        <RouterLink
          to="/deployments"
          :class="[navBase, 'text-muted-foreground hover:bg-accent hover:text-foreground']"
          active-class="bg-accent! text-foreground!"
        >
          <Rocket class="size-4" />
          Deployments
        </RouterLink>

        <RouterLink
          to="/databases"
          :class="[navBase, 'text-muted-foreground hover:bg-accent hover:text-foreground']"
          active-class="bg-accent! text-foreground!"
        >
          <Database class="size-4" />
          Databases
        </RouterLink>
      </nav>

      <div class="border-t border-border p-3">
        <div class="flex items-center gap-3 px-2 py-1.5">
          <div
            class="flex size-8 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary"
          >
            {{ initial }}
          </div>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-foreground">
              {{ auth.user?.displayName || auth.user?.username }}
            </p>
            <p class="truncate text-xs text-muted-foreground">{{ auth.user?.email }}</p>
          </div>
          <Button variant="ghost" size="icon-sm" title="Sign out" @click="onLogout">
            <LogOut />
          </Button>
        </div>
      </div>
    </aside>

    <div class="flex min-w-0 flex-col">
      <main class="flex-1 overflow-y-auto">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Database, FolderGit2, Plug, Rocket, ScrollText, Search, Sparkles, Timer } from '@lucide/vue'
import { useProjects } from '@/features/projects/projects.queries'
import { useCan } from '@/features/orgs/useCan'

const router = useRouter()
const route = useRoute()
const { data: projects } = useProjects()
const canSeeAudit = useCan('audit.read')

const open = ref(false)
const term = ref('')
const cursor = ref(0)
const inputEl = ref<HTMLInputElement | null>(null)
const listEl = ref<HTMLElement | null>(null)

type Item = { id: string; label: string; hint?: string; icon: unknown; to: string }

const pages = computed<Item[]>(() => {
  const base: Item[] = [
    { id: 'p:projects', label: 'Projects', icon: FolderGit2, to: '/' },
    { id: 'p:deployments', label: 'Deployments', icon: Rocket, to: '/deployments' },
    { id: 'p:templates', label: 'Templates', icon: Sparkles, to: '/templates' },
    { id: 'p:tasks', label: 'Scheduled tasks', icon: Timer, to: '/scheduled-tasks' },
    { id: 'p:databases', label: 'Databases', icon: Database, to: '/databases' },
    { id: 'p:integrations', label: 'Integrations', icon: Plug, to: '/integrations' },
  ]
  if (canSeeAudit.value) {
    base.push({ id: 'p:audit', label: 'Activity', icon: ScrollText, to: '/audit' })
  }
  return base
})

const projectItems = computed<Item[]>(() =>
  (projects.value ?? []).map((p) => ({
    id: `proj:${p.id}`,
    label: p.name,
    hint: p.providerRepoFullName ?? p.subdomain,
    icon: FolderGit2,
    to: `/projects/${p.id}`,
  })),
)

function match(item: Item, q: string) {
  if (!q) return true
  const hay = `${item.label} ${item.hint ?? ''}`.toLowerCase()
  return hay.includes(q)
}

const groups = computed(() => {
  const q = term.value.trim().toLowerCase()
  return [
    { label: 'Go to', items: pages.value.filter((i) => match(i, q)) },
    { label: 'Projects', items: projectItems.value.filter((i) => match(i, q)) },
  ].filter((g) => g.items.length > 0)
})

const flat = computed(() => groups.value.flatMap((g) => g.items))

watch(flat, () => {
  cursor.value = 0
})

function show() {
  open.value = true
  term.value = ''
  cursor.value = 0
  void nextTick(() => inputEl.value?.focus())
}

function hide() {
  open.value = false
}

// Any navigation dismisses it — browser back/forward and in-app links would
// otherwise leave the palette floating over a page the user already moved to.
watch(() => route.fullPath, hide)

function choose(item: Item | undefined) {
  if (!item) return
  hide()
  void router.push(item.to)
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    if (open.value) hide()
    else show()
    return
  }
  if (!open.value) return
  if (e.key === 'Escape') {
    e.preventDefault()
    hide()
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    cursor.value = (cursor.value + 1) % Math.max(flat.value.length, 1)
    scrollActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    cursor.value = (cursor.value - 1 + flat.value.length) % Math.max(flat.value.length, 1)
    scrollActiveIntoView()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    choose(flat.value[cursor.value])
  }
}

function scrollActiveIntoView() {
  void nextTick(() => {
    listEl.value
      ?.querySelector('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' })
  })
}

// Index within the flattened list, so arrow keys cross group boundaries.
function indexOf(item: Item) {
  return flat.value.findIndex((i) => i.id === item.id)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

defineExpose({ show })
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-150"
      leave-active-class="transition-opacity duration-100"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="open" class="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]" @click="hide" />
    </Transition>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      leave-active-class="transition duration-100 ease-in"
      enter-from-class="opacity-0 scale-[0.98]"
      leave-to-class="opacity-0 scale-[0.98]"
    >
      <div
        v-if="open"
        class="fixed left-1/2 top-[15vh] z-50 w-[min(36rem,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-rule bg-popover shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
      >
        <div class="flex items-center gap-3 border-b border-rule px-4">
          <Search class="size-4 shrink-0 text-ink-4" aria-hidden="true" />
          <input
            ref="inputEl"
            v-model="term"
            type="text"
            aria-label="Search projects and pages"
            placeholder="Jump to a project or page…"
            class="h-12 min-w-0 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
          />
          <kbd class="shrink-0 rounded border border-rule px-1.5 py-0.5 font-mono text-[10px] text-ink-4">
            esc
          </kbd>
        </div>

        <div ref="listEl" class="max-h-[50vh] overflow-y-auto p-2">
          <p v-if="flat.length === 0" class="px-3 py-8 text-center text-sm text-ink-3">
            Nothing matches “{{ term }}”.
          </p>

          <div v-for="group in groups" :key="group.label" class="mb-1 last:mb-0">
            <p class="eyebrow px-3 py-1.5">{{ group.label }}</p>
            <button
              v-for="item in group.items"
              :key="item.id"
              type="button"
              :data-active="indexOf(item) === cursor"
              class="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors data-[active=true]:bg-accent"
              @mouseenter="cursor = indexOf(item)"
              @click="choose(item)"
            >
              <component :is="item.icon" class="size-4 shrink-0 text-ink-4" aria-hidden="true" />
              <span class="truncate text-ink-1">{{ item.label }}</span>
              <span v-if="item.hint" class="ml-auto truncate font-mono text-xs text-ink-4">
                {{ item.hint }}
              </span>
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight, GitBranch, KeyRound, Rocket } from '@lucide/vue'

const open = ref(false)
</script>

<template>
  <div class="rounded-xl border border-border bg-card">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-4 py-3 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <ChevronRight
        class="size-4 shrink-0 text-muted-foreground/60 transition-transform"
        :class="open && 'rotate-90'"
      />
      <span class="text-sm font-medium text-foreground">How GitHub integration works</span>
      <span class="ml-auto text-xs text-muted-foreground/70">
        {{ open ? 'Hide' : 'Learn more' }}
      </span>
    </button>

    <div v-if="open" class="border-t border-border/60 px-4 py-4">
      <ul class="space-y-3 text-sm text-muted-foreground">
        <li class="flex gap-3">
          <KeyRound class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span class="text-foreground">Connecting</span> sends you to GitHub to authorize
            Lighthouse. The token is stored encrypted on the server and never reaches your browser —
            connecting grants repo access, it does not sign you in.
          </span>
        </li>
        <li class="flex gap-3">
          <GitBranch class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Lighthouse requests two scopes:
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground">repo</code>
            to read and clone your repositories (including private ones), and
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >read:org</code
            >
            so org-owned repos you can access show up in the browser below.
          </span>
        </li>
        <li class="flex gap-3">
          <Rocket class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            Pick a repo and hit <span class="text-foreground">Deploy</span> — that opens the
            Create-Project dialog pre-filled with the repo. Confirm, and Lighthouse clones it
            authenticated and deploys through the normal pipeline.
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

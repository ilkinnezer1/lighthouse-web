<script setup lang="ts">
import { ref } from 'vue'
import { Building2, ChevronRight, KeyRound, Tag } from '@lucide/vue'

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
      <span class="text-sm font-medium text-foreground">How Jira integration works</span>
      <span class="ml-auto text-xs text-muted-foreground/70">
        {{ open ? 'Hide' : 'Learn more' }}
      </span>
    </button>

    <div v-if="open" class="border-t border-border/60 px-4 py-4">
      <ul class="space-y-3 text-sm text-muted-foreground">
        <li class="flex gap-3">
          <Tag class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span class="text-foreground">Branch names are read as tickets.</span> A branch like
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >feature/PROJ-12-add-login</code
            >
            is matched against the usual key shape, and Lighthouse asks Jira for that issue's
            summary — so the branch reads as
            <span class="text-foreground">PROJ-12: Add login</span> in the branch picker and on a
            deployment. A branch that names no ticket is shown exactly as before.
          </span>
        </li>
        <li class="flex gap-3">
          <KeyRound class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span class="text-foreground">Connecting is personal.</span> You authorize Atlassian for
            your own account and the tokens are stored encrypted on the server — Lighthouse only
            ever reads issues <em>your</em> Jira account may already read. It requests
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >read:jira-work</code
            >,
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >read:jira-user</code
            >,
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >read:me</code
            >
            and
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs text-foreground"
              >offline_access</code
            >. Nothing is ever written back to Jira.
          </span>
        </li>
        <li class="flex gap-3">
          <Building2 class="mt-0.5 size-4 shrink-0 text-primary" />
          <span>
            <span class="text-foreground">The site is the organization's.</span> An admin picks one
            Jira site for the org, so everyone sees the same labels — each resolved with their own
            account. Until a site is chosen, branches keep their plain names. Labels are recorded on
            a deployment when it is queued, so past deploys still read as their ticket after it is
            renamed, or after Jira is disconnected.
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>

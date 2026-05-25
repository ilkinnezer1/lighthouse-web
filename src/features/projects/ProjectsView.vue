<script setup lang="ts">
import { FolderGit2, Plus } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
        <p class="mt-1 text-sm text-muted-foreground">Connect a Git repo and deploy it.</p>
      </div>
      <Button disabled>
        <Plus />
        New project
      </Button>
    </header>

    <div
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <FolderGit2 class="size-6 text-primary" />
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No projects yet</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Project creation lands in the next step. You're signed in and the foundation is
        wired up end to end.
      </p>
    </div>
  </div>
</template>

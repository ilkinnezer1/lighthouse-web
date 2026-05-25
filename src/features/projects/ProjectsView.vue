<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {FolderGit2, GitBranch, Plus, RotateCcw} from 'lucide-vue-next'
import {useProjects} from './projects.queries'
import CreateProjectDialog from './CreateProjectDialog.vue'
import {relativeTime} from '@/lib/time'
import {apiErrorMessage} from '@/lib/api'
import type {Project} from '@/types/api'
import {Button} from '@/components/ui/button'
import {Badge} from '@/components/ui/badge'
import {Skeleton} from '@/components/ui/skeleton'

const router = useRouter()
const {data: projects, isPending, isError, error, refetch} = useProjects()
const dialogOpen = ref(false)

function repoLabel(p: Project) {
  return (
      p.providerRepoFullName ||
      p.repoUrl.replace(/^https?:\/\//, '').replace(/\.git$/, '')
  )
}

function goToProject(id: string) {
  router.push(`/projects/${id}`)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-6 py-10 sm:px-10">
    <header class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-foreground">Projects</h1>
        <p class="mt-1 text-sm text-muted-foreground">Connect a Git repo and deploy it.</p>
      </div>
      <Button @click="dialogOpen = true">
        <Plus/>
        New project
      </Button>
    </header>

    <!-- loading -->
    <div v-if="isPending" class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div v-for="n in 3" :key="n" class="rounded-xl border border-border p-5">
        <Skeleton class="h-5 w-32"/>
        <Skeleton class="mt-3 h-4 w-44"/>
        <Skeleton class="mt-6 h-5 w-20"/>
      </div>
    </div>

    <!-- error -->
    <div
        v-else-if="isError"
        class="mt-8 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(error) }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
        <RotateCcw/>
        Retry
      </Button>
    </div>

    <!-- empty -->
    <div
        v-else-if="!projects || projects.length === 0"
        class="mt-10 flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-20 text-center"
    >
      <div class="flex size-12 items-center justify-center rounded-full bg-primary/10">
        <FolderGit2 class="size-6 text-primary"/>
      </div>
      <h2 class="mt-4 text-base font-medium text-foreground">No projects yet</h2>
      <p class="mt-1 max-w-sm text-sm text-muted-foreground">
        Connect a public Git repository to deploy it with Lighthouse.
      </p>
      <Button class="mt-5" @click="dialogOpen = true">
        <Plus/>
        New project
      </Button>
    </div>

    <!-- list -->
    <div v-else class="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <button
          v-for="project in projects"
          :key="project.id"
          type="button"
          class="group flex flex-col rounded-xl border border-border bg-card p-5 text-left transition-colors hover:border-primary/40 hover:bg-accent/40 focus-visible:border-primary focus-visible:outline-none"
          @click="goToProject(project.id)"
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="truncate font-medium text-foreground">{{ project.name }}</h3>
          <Badge variant="secondary" class="font-mono">{{ project.subdomain }}</Badge>
        </div>
        <p class="mt-1 truncate font-mono text-xs text-muted-foreground">
          {{ repoLabel(project) }}
        </p>
        <div class="mt-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span class="inline-flex items-center gap-1">
            <GitBranch class="size-3.5"/>
            {{ project.defaultBranch }}
          </span>
          <span aria-hidden>·</span>
          <span>{{ relativeTime(project.createdAt) }}</span>
        </div>
      </button>
    </div>

    <CreateProjectDialog
        v-model:open="dialogOpen"
        @created="(p) => goToProject(p.id)"
    />
  </div>
</template>

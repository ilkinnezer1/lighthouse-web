<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {ExternalLink, Plus} from '@lucide/vue'
import {useProjects} from './projects.queries'
import {useProjectStatuses} from './project-status'
import CreateProjectDialog from './CreateProjectDialog.vue'
import {useCan} from '@/features/orgs/useCan'
import {statusTone, titleCase} from '@/features/deployments/deployments.status'
import {relativeTime} from '@/lib/time'
import {apiErrorMessage} from '@/lib/api'
import type {Project} from '@/types/api'
import {Button} from '@/components/ui/button'
import {
  EmptyState,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
  SignalDot,
} from '@/components/ui/section'

const router = useRouter()
const {data: projects, isPending, isError, error, refetch} = useProjects()
const {byProject} = useProjectStatuses()
const canCreate = useCan('project.create')
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
  <PageShell>
    <PageHead eyebrow="Workspace" title="Projects" deck="Connect a Git repo and deploy it.">
      <template #actions>
        <Button v-if="canCreate" @click="dialogOpen = true">
          <Plus/>
          New project
        </Button>
      </template>
    </PageHead>

    <div class="mt-12">
      <!-- loading -->
      <div v-if="isPending">
        <SectionHead eyebrow="All projects"/>
        <LoadingRows :rows="4"/>
      </div>

      <!-- error -->
      <ErrorState
          v-else-if="isError"
          :message="apiErrorMessage(error, 'Could not load projects.')"
          @retry="() => refetch()"
      />

      <!-- empty -->
      <EmptyState
          v-else-if="!projects || projects.length === 0"
          title="Nothing connected yet"
          deck="Point Lighthouse at a Git repository and it will build and serve it."
      >
        <template #action>
          <Button v-if="canCreate" @click="dialogOpen = true">
            <Plus/>
            New project
          </Button>
        </template>
      </EmptyState>

      <!-- list -->
      <div v-else>
        <SectionHead eyebrow="All projects" :count="projects.length"/>
        <div class="rule-y">
          <div
              v-for="project in projects"
              :key="project.id"
              class="group relative flex items-center gap-4 transition-colors hover:bg-accent/40 focus-within:bg-accent/40"
          >
            <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-4 py-4 text-left focus-visible:outline-none"
                @click="goToProject(project.id)"
            >
              <SignalDot
                  v-if="byProject.get(project.id)"
                  :tone="statusTone[byProject.get(project.id)!.status]"
                  :title="titleCase(byProject.get(project.id)!.status)"
              />
              <span v-else class="size-2 shrink-0 rounded-full border border-rule" title="Never deployed"/>

              <span class="min-w-0 shrink-0 basis-56">
                <span class="block truncate text-[0.9375rem] text-ink-1">{{ project.name }}</span>
                <span class="mt-0.5 block truncate font-mono text-xs text-ink-4">
                  {{ repoLabel(project) }}
                </span>
              </span>

              <span class="min-w-0 flex-1 truncate text-xs text-ink-3">
                <template v-if="byProject.get(project.id)">
                  {{ byProject.get(project.id)!.commitMessage ?? 'No commit message' }}
                </template>
                <span v-else class="text-ink-4">Never deployed</span>
              </span>

              <span class="hidden shrink-0 basis-28 text-right text-xs text-ink-4 sm:block">
                <template v-if="byProject.get(project.id)">
                  {{ relativeTime(byProject.get(project.id)!.createdAt) }}
                </template>
                <template v-else>—</template>
              </span>
            </button>

            <!-- The live URL is the thing you actually want off this row; keep it
                 a real link so middle-click and copy-link behave. -->
            <a
                v-if="byProject.get(project.id)?.url"
                :href="byProject.get(project.id)!.url"
                target="_blank"
                rel="noopener noreferrer"
                class="shrink-0 rounded-md p-2 text-ink-4 opacity-0 transition hover:bg-accent hover:text-ink-1 focus-visible:opacity-100 group-hover:opacity-100"
                :title="`Open ${byProject.get(project.id)!.url}`"
                @click.stop
            >
              <ExternalLink class="size-4"/>
            </a>
            <span v-else class="size-8 shrink-0"/>
          </div>
        </div>
      </div>
    </div>

    <CreateProjectDialog
        v-model:open="dialogOpen"
        @created="(p) => goToProject(p.id)"
    />
  </PageShell>
</template>

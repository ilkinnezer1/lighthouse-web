<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  GitBranch,
  LoaderCircle,
  RotateCcw,
  Settings2,
  Trash2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDeleteProject, useProject } from './projects.queries'
import ProjectSettingsDialog from './ProjectSettingsDialog.vue'
import { useCan } from '@/features/orgs/useCan'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { EnvironmentType } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{ id: string }>()
const router = useRouter()

const { data: project, isPending, isError, error, refetch } = useProject(() => props.id)
const deleteProject = useDeleteProject()
const canEditProject = useCan('env.manage')
const canDeleteProject = useCan('project.delete')

const showSecret = ref(false)
const showSettings = ref(false)
const webhookUrl = computed(() => `${window.location.origin}/webhooks/github`)

const envBadge: Record<EnvironmentType, 'default' | 'secondary' | 'outline'> = {
  PRODUCTION: 'default',
  PREVIEW: 'secondary',
  MANUAL: 'outline',
}

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copied`)
  } catch {
    toast.error('Copy failed')
  }
}

async function onDelete() {
  try {
    await deleteProject.mutateAsync(props.id)
    toast.success('Project deleted')
    await router.replace('/')
  } catch (err) {
    toast.error(apiErrorMessage(err, 'Could not delete project'))
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-10 sm:px-10">
    <RouterLink
      to="/"
      class="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
    >
      <ArrowLeft class="size-4" />
      Projects
    </RouterLink>

    <!-- loading -->
    <div v-if="isPending" class="mt-6 space-y-6">
      <Skeleton class="h-8 w-56" />
      <Skeleton class="h-40 w-full rounded-xl" />
      <Skeleton class="h-40 w-full rounded-xl" />
    </div>

    <!-- error -->
    <div
      v-else-if="isError || !project"
      class="mt-10 flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 py-16 text-center"
    >
      <p class="text-sm text-destructive">{{ apiErrorMessage(error, 'Project not found.') }}</p>
      <Button variant="outline" size="sm" class="mt-4" @click="() => refetch()">
        <RotateCcw />
        Retry
      </Button>
    </div>

    <template v-else>
      <header class="mt-4 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight text-foreground">{{ project.name }}</h1>
          <a
            :href="project.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="mt-1 inline-block font-mono text-sm text-muted-foreground hover:text-foreground hover:underline"
          >
            {{ project.providerRepoFullName || project.repoUrl }}
          </a>
        </div>

        <div class="flex items-center gap-2">
          <Button v-if="canEditProject" variant="outline" size="sm" @click="showSettings = true">
            <Settings2 />
            Settings
          </Button>
          <AlertDialog v-if="canDeleteProject">
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" class="text-destructive hover:text-destructive">
              <Trash2 />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {{ project.name }}?</AlertDialogTitle>
              <AlertDialogDescription>
                This removes the project and its environments. Deployed containers are torn
                down. This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                class="bg-destructive text-white hover:bg-destructive/90"
                :disabled="deleteProject.isPending.value"
                @click="onDelete"
              >
                <LoaderCircle v-if="deleteProject.isPending.value" class="animate-spin" />
                Delete project
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        </div>
      </header>

      <!-- meta -->
      <dl class="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Subdomain</dt>
          <dd class="mt-1 font-mono text-sm text-foreground">{{ project.subdomain }}</dd>
        </div>
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Default branch</dt>
          <dd class="mt-1 inline-flex items-center gap-1.5 font-mono text-sm text-foreground">
            <GitBranch class="size-3.5" />
            {{ project.defaultBranch }}
          </dd>
        </div>
        <div class="bg-card px-4 py-3">
          <dt class="text-xs text-muted-foreground">Created</dt>
          <dd class="mt-1 text-sm text-foreground">{{ relativeTime(project.createdAt) }}</dd>
        </div>
      </dl>

      <!-- environments -->
      <section class="mt-8">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Environments</h2>
        <div class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border">
          <RouterLink
            v-for="env in project.environments ?? []"
            :key="env.id"
            :to="`/projects/${project.id}/env/${env.id}`"
            class="flex items-center justify-between gap-3 bg-card px-4 py-3 transition-colors hover:bg-accent/40"
          >
            <div class="flex items-center gap-3">
              <Badge :variant="envBadge[env.type]" class="font-mono">{{ env.name }}</Badge>
              <span class="font-mono text-xs text-muted-foreground">
                {{ env.branch ?? '—' }}
              </span>
            </div>
            <ChevronRight class="size-4 text-muted-foreground" />
          </RouterLink>
          <p
            v-if="!project.environments?.length"
            class="bg-card px-4 py-6 text-center text-sm text-muted-foreground"
          >
            No environments.
          </p>
        </div>
      </section>

      <!-- webhook -->
      <section class="mt-8">
        <h2 class="text-sm font-semibold tracking-tight text-foreground">Auto-deploy webhook</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Add this webhook to your repo (Settings → Webhooks) to deploy on push and open
          preview environments for pull requests.
        </p>

        <div class="mt-3 space-y-3 rounded-xl border border-border bg-card p-4">
          <div>
            <p class="text-xs text-muted-foreground">Payload URL</p>
            <div class="mt-1 flex items-center gap-2">
              <code
                class="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground"
              >{{ webhookUrl }}</code>
              <Button variant="ghost" size="icon-sm" title="Copy URL" @click="copy(webhookUrl, 'URL')">
                <Copy />
              </Button>
            </div>
            <p class="mt-1 text-xs text-muted-foreground/70">
              Use your Lighthouse host's public URL. Content type: application/json.
            </p>
          </div>

          <div v-if="project.webhookSecret">
            <p class="text-xs text-muted-foreground">Secret</p>
            <div class="mt-1 flex items-center gap-2">
              <code
                class="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground"
              >{{ showSecret ? project.webhookSecret : '•'.repeat(32) }}</code>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="showSecret ? 'Hide' : 'Reveal'"
                @click="showSecret = !showSecret"
              >
                <Eye v-if="!showSecret" />
                <EyeOff v-else />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                title="Copy secret"
                @click="copy(project.webhookSecret, 'Secret')"
              >
                <Copy />
              </Button>
            </div>
          </div>
        </div>
      </section>

      <ProjectSettingsDialog v-model:open="showSettings" :project="project" />
    </template>
  </div>
</template>

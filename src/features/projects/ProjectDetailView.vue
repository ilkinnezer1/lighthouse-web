<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import {
  ArrowRightLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  LoaderCircle,
  Rocket,
  Settings2,
  Trash2,
} from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDeleteProject, useProject } from './projects.queries'
import { useProjectStatuses } from './project-status'
import ProjectSettingsDialog from './ProjectSettingsDialog.vue'
import TransferProjectDialog from './TransferProjectDialog.vue'
import DeployDialog from '@/features/deployments/DeployDialog.vue'
import EnvironmentSleepBadge from '@/features/environments/EnvironmentSleepBadge.vue'
import { SLEEPING_URL_NOTE, isSleeping } from '@/features/environments/environments.hibernation'
import { statusTone, titleCase } from '@/features/deployments/deployments.status'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { useCan } from '@/features/orgs/useCan'
import { relativeTime } from '@/lib/time'
import { apiErrorMessage } from '@/lib/api'
import type { Deployment, EnvironmentType } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Breadcrumb,
  ErrorState,
  LoadingRows,
  PageHead,
  PageShell,
  SectionHead,
  SignalDot,
} from '@/components/ui/section'
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
const active = useActiveOrgStore()

const { data: project, isPending, isError, error, refetch } = useProject(() => props.id)
const { byEnvironment } = useProjectStatuses()
const deleteProject = useDeleteProject()
const canEditProject = useCan('env.manage')
const canDeleteProject = useCan('project.delete')
const canDeploy = useCan('deploy')

// Deploying is the primary verb — it shouldn't only exist one level deeper.
const primaryEnv = computed(() => {
  const envs = project.value?.environments ?? []
  return envs.find((e) => e.type === 'PRODUCTION') ?? envs[0] ?? null
})
const showDeploy = ref(false)
function onDeployed(dep: Deployment) {
  void router.push(`/deployments/${dep.id}`)
}
// Gate transfer on the project's *current* org (Admin+ there), not the active
// org — the user may be viewing it from a different scope.
const canTransferProject = useCan('project.transfer', () => project.value?.organizationId)

const showSecret = ref(false)
const showSettings = ref(false)
const showTransfer = ref(false)
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

// Follow the project into its new org so it stays in view, then land on the
// dashboard scoped there.
async function onTransferred(organizationId: string) {
  active.setActiveOrg(organizationId)
  await router.push('/')
}
</script>

<template>
  <PageShell>
    <Breadcrumb :items="[{ label: 'Projects', to: '/' }, { label: project?.name ?? 'Project' }]" />

    <!-- loading -->
    <div v-if="isPending" class="mt-10">
      <Skeleton class="h-9 w-64" />
      <LoadingRows class="mt-10" :rows="3" />
    </div>

    <!-- error -->
    <ErrorState
      v-else-if="isError || !project"
      class="mt-10"
      :message="apiErrorMessage(error, 'Project not found.')"
      @retry="() => refetch()"
    />

    <template v-else>
      <PageHead eyebrow="Project" :title="project.name" class="mt-5">
        <template #deck>
          <a
            :href="project.repoUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-mono text-xs text-ink-3 hover:text-ink-1 hover:underline"
          >
            {{ project.providerRepoFullName || project.repoUrl }}
          </a>
        </template>

        <template #actions>
          <Button v-if="canDeploy && primaryEnv" size="sm" @click="showDeploy = true">
            <Rocket />
            Deploy
          </Button>
          <Button v-if="canEditProject" variant="outline" size="sm" @click="showSettings = true">
            <Settings2 />
            Settings
          </Button>
          <Button
            v-if="canTransferProject"
            variant="outline"
            size="sm"
            @click="showTransfer = true"
          >
            <ArrowRightLeft />
            Transfer
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
                  This removes the project and its environments. Deployed containers are torn down.
                  This cannot be undone.
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
        </template>
      </PageHead>

      <!-- environments — the daily surface, so it leads -->
      <section class="mt-12">
        <SectionHead eyebrow="Environments" :count="project.environments?.length ?? 0" />
        <div class="rule-y">
          <RouterLink
            v-for="env in project.environments ?? []"
            :key="env.id"
            :to="`/projects/${project.id}/env/${env.id}`"
            class="group flex items-center gap-4 py-4 transition-colors hover:bg-accent/40"
          >
            <SignalDot
              v-if="byEnvironment.get(env.id)"
              :tone="statusTone[byEnvironment.get(env.id)!.status]"
              :title="titleCase(byEnvironment.get(env.id)!.status)"
            />
            <span
              v-else
              class="size-2 shrink-0 rounded-full border border-rule"
              title="Never deployed"
            />

            <span class="flex shrink-0 basis-40 items-center gap-2.5">
              <Badge :variant="envBadge[env.type]" class="font-mono">{{ env.name }}</Badge>
              <span class="font-mono text-xs text-ink-4">{{ env.branch ?? '—' }}</span>
            </span>

            <span class="min-w-0 flex-1 truncate text-xs text-ink-3">
              <template v-if="byEnvironment.get(env.id)">
                {{ byEnvironment.get(env.id)!.commitMessage ?? 'No commit message' }}
              </template>
              <span v-else class="text-ink-4">Never deployed</span>
            </span>

            <span class="hidden shrink-0 basis-24 lg:block">
              <EnvironmentSleepBadge :hibernation="env.hibernation" />
            </span>

            <span class="hidden shrink-0 basis-24 text-right text-xs text-ink-4 sm:block">
              <template v-if="byEnvironment.get(env.id)">
                {{ relativeTime(byEnvironment.get(env.id)!.createdAt) }}
              </template>
              <template v-else>—</template>
            </span>

            <!-- Dimmed and relabelled while asleep: the address 404s until the
                 environment is woken, and this row is the way to that page. -->
            <a
              v-if="byEnvironment.get(env.id)?.url"
              :href="byEnvironment.get(env.id)!.url"
              target="_blank"
              rel="noopener noreferrer"
              class="shrink-0 rounded-md p-1.5 transition hover:bg-accent hover:text-ink-1"
              :class="isSleeping(env.hibernation) ? 'text-ink-4/50' : 'text-ink-4'"
              :title="
                isSleeping(env.hibernation)
                  ? `${SLEEPING_URL_NOTE} — open this environment to wake it`
                  : `Open ${byEnvironment.get(env.id)!.url}`
              "
              @click.stop
            >
              <ExternalLink class="size-4" />
            </a>
            <ChevronRight class="size-4 shrink-0 text-ink-4" />
          </RouterLink>
          <p v-if="!project.environments?.length" class="py-8 text-center text-sm text-ink-3">
            No environments.
          </p>
        </div>
      </section>

      <!-- webhook — configured once, so it collapses out of the way -->
      <details class="mt-10 border-t border-rule pt-4">
        <summary
          class="cursor-pointer list-none text-sm text-ink-3 transition-colors marker:content-none hover:text-ink-1"
        >
          Auto-deploy webhook
          <span class="ml-1 text-ink-4">· set up once</span>
        </summary>

        <p class="mt-3 max-w-prose text-sm text-ink-3">
          Add this webhook to your repo (Settings → Webhooks) to deploy on push and open preview
          environments for pull requests.
        </p>

        <div class="mt-4 space-y-3 rounded-lg bg-sunken p-4">
          <div>
            <p class="text-xs text-muted-foreground">Payload URL</p>
            <div class="mt-1 flex items-center gap-2">
              <code
                class="min-w-0 flex-1 truncate rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs text-foreground"
                >{{ webhookUrl }}</code
              >
              <Button
                variant="ghost"
                size="icon-sm"
                title="Copy URL"
                @click="copy(webhookUrl, 'URL')"
              >
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
                >{{ showSecret ? project.webhookSecret : '•'.repeat(32) }}</code
              >
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
      </details>

      <ProjectSettingsDialog v-model:open="showSettings" :project="project" />
      <TransferProjectDialog
        v-model:open="showTransfer"
        :project="project"
        @transferred="onTransferred"
      />
      <DeployDialog
        v-if="primaryEnv"
        v-model:open="showDeploy"
        :project-id="project.id"
        :env-id="primaryEnv.id"
        :default-branch="primaryEnv.branch ?? project.defaultBranch"
        :github-linked="!!project.providerRepoFullName"
        @deployed="onDeployed"
      />
    </template>
  </PageShell>
</template>

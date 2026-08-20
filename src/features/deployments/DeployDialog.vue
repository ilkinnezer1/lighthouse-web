<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GitMerge, LoaderCircle, RefreshCw, Rocket } from '@lucide/vue'
import { toast } from 'vue-sonner'
import BranchPicker from './BranchPicker.vue'
import DeployLockedDialog from './DeployLockedDialog.vue'
import { lockConflict } from '@/features/environments/environments.lock'
import { useInvalidateLockState } from '@/features/environments/environments.queries'
import { useMergeCheck } from './deployments.queries'
import { useCreateDeployment } from './deployments.queries'
import { useProjectBranches } from '@/features/projects/projects.queries'
import { toBranchMetaMap } from '@/features/projects/branchMeta'
import { apiErrorMessage } from '@/lib/api'
import type { Deployment, EnvironmentLock, MergeCheckResult } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const props = defineProps<{
  projectId: string
  envId: string
  defaultBranch: string | null
}>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ deployed: [deployment: Deployment] }>()

const createDeployment = useCreateDeployment(() => props.envId)
const mergeCheck = useMergeCheck(() => props.envId)

// Cleared whenever the branch set changes: a verdict about a different set of
// branches is worse than no verdict, because it reads as if it still applies.
const checkResult = ref<MergeCheckResult | null>(null)
async function onCheckMerge() {
  checkResult.value = null
  checkResult.value = await mergeCheck.mutateAsync({
    sourceBranch: sourceBranch.value || props.defaultBranch || undefined,
    mergeBranches: mergeBranches.value,
  })
}

const sourceBranch = ref('')
const mergeBranches = ref<string[]>([])
const advanced = ref(false)

const branchesQuery = useProjectBranches(() => props.projectId, {
  base: () => sourceBranch.value || undefined,
  enabled: () => open.value,
})
const branches = computed(() => branchesQuery.data.value ?? [])
const branchError = computed(() =>
  branchesQuery.isError.value
    ? apiErrorMessage(branchesQuery.error.value, 'Could not load branches')
    : null,
)

const branchMeta = computed(() => toBranchMetaMap(branches.value))

watch([sourceBranch, mergeBranches], () => {
  checkResult.value = null
})

watch(open, (isOpen) => {
  if (isOpen) {
    sourceBranch.value = props.defaultBranch ?? ''
    mergeBranches.value = []
    advanced.value = false
    lockedBy.value = null
  }
})

watch(sourceBranch, (src) => {
  mergeBranches.value = mergeBranches.value.filter((b) => b !== src)
})

watch(branches, (list) => {
  if (!list.length) return
  if (!sourceBranch.value || !list.some((b) => b.name === sourceBranch.value)) {
    const fallback =
      props.defaultBranch && list.some((b) => b.name === props.defaultBranch)
        ? props.defaultBranch
        : list[0].name
    sourceBranch.value = fallback
  }
})

const isPending = computed(() => createDeployment.isPending.value)

async function onFetch() {
  try {
    await branchesQuery.refresh()
    toast.success('Fetched latest commits')
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not fetch branches'))
  }
}

const lockedBy = ref<EnvironmentLock | null>(null)
const invalidateLockState = useInvalidateLockState()

async function runDeploy(overrideLock: boolean) {
  const source = sourceBranch.value || props.defaultBranch || undefined
  const merges = mergeBranches.value
  try {
    const dep = await createDeployment.mutateAsync({
      sourceBranch: source,
      mergeBranches: merges.length ? merges : undefined,
      ...(overrideLock ? { overrideLock: true } : {}),
    })
    toast.success(
      merges.length
        ? `Deploying ${source} + ${merges.length} merged branch${merges.length === 1 ? '' : 'es'}`
        : 'Deployment queued',
    )
    lockedBy.value = null
    open.value = false
    emit('deployed', dep)
  } catch (e) {
    const lock = lockConflict(e)
    if (lock) {
      // The 409 carries the lock as the server sees it — fresher than our cache,
      // which is also why the board is refreshed off the back of it.
      lockedBy.value = lock
      invalidateLockState(props.projectId)
      return
    }
    toast.error(apiErrorMessage(e, 'Could not start deployment'))
  }
}

function onDeploy() {
  void runDeploy(false)
}

function onDeployAnyway() {
  void runDeploy(true)
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Deploy</DialogTitle>
        <DialogDescription>
          Pick the source branch to build, and optionally merge feature branches into it first.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4 py-1">
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <span class="text-sm font-medium text-foreground">Source branch</span>
            <button
              type="button"
              class="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              :disabled="branchesQuery.isRefreshing.value || branchesQuery.isPending.value"
              @click="onFetch"
            >
              <RefreshCw
                class="size-3.5"
                :class="{ 'animate-spin': branchesQuery.isRefreshing.value }"
              />
              Fetch
            </button>
          </div>
          <Select v-model="sourceBranch" :disabled="branchesQuery.isPending.value || !!branchError">
            <SelectTrigger class="w-full font-mono">
              <SelectValue :placeholder="defaultBranch ?? 'Select a branch'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="b in branches" :key="b.name" :value="b.name" class="font-mono">
                {{ b.name }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="branchError" class="text-xs text-destructive">{{ branchError }}</p>
          <p v-else class="text-xs text-muted-foreground">
            Deploys the latest commit on this branch.
          </p>
        </div>

        <div class="grid gap-2">
          <button
            v-if="!advanced"
            type="button"
            class="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            @click="advanced = true"
          >
            <GitMerge class="size-4" />
            Merge feature branches…
          </button>
          <template v-else>
            <span class="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <GitMerge class="size-4" />
              Merge into <span class="font-mono">{{ sourceBranch || '—' }}</span>
            </span>
            <BranchPicker
              v-model="mergeBranches"
              :branches="branches"
              :exclude="sourceBranch"
              :loading="branchesQuery.isPending.value"
              :error="branchError"
              :meta="branchMeta"
            />
            <p class="text-xs text-muted-foreground">
              Branches are merged in order on top of the source. A merge conflict fails the
              deployment.
            </p>

            <div v-if="mergeBranches.length" class="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                type="button"
                :disabled="mergeCheck.isPending.value || !sourceBranch"
                @click="onCheckMerge"
              >
                <LoaderCircle v-if="mergeCheck.isPending.value" class="animate-spin" />
                <GitMerge v-else class="size-4" />
                Check for conflicts
              </Button>

              <!-- Three outcomes, and "could not tell" must not read as "fine". -->
              <span
                v-if="checkResult?.mergeable === true"
                class="text-xs font-medium text-signal-live"
              >
                These branches merge cleanly.
              </span>
              <span
                v-else-if="checkResult?.mergeable === false"
                class="text-xs font-medium text-destructive"
              >
                <span class="font-mono">{{ checkResult.branch }}</span> conflicts<template
                  v-if="checkResult.files?.length"
                >
                  in
                  <span class="font-mono">{{ checkResult.files.join(', ') }}</span></template
                >. Deploying will fail.
              </span>
              <span
                v-else-if="checkResult && checkResult.mergeable === null"
                class="text-xs text-muted-foreground"
              >
                Could not check — deploy anyway and the build will report any conflict.
              </span>
            </div>
          </template>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="isPending" @click="open = false">
          Cancel
        </Button>
        <Button type="button" :disabled="isPending || !sourceBranch" @click="onDeploy">
          <LoaderCircle v-if="isPending" class="animate-spin" />
          <Rocket v-else />
          Deploy
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <DeployLockedDialog
    :open="lockedBy !== null"
    :lock="lockedBy"
    :pending="isPending"
    @update:open="(v: boolean) => !v && (lockedBy = null)"
    @override="onDeployAnyway"
  />
</template>

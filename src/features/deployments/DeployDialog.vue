<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { GitMerge, LoaderCircle, RefreshCw, Rocket } from '@lucide/vue'
import { toast } from 'vue-sonner'
import BranchPicker from './BranchPicker.vue'
import { useCreateDeployment } from './deployments.queries'
import { useProjectBranches } from '@/features/projects/projects.queries'
import { toBranchMetaMap } from '@/features/projects/branchMeta'
import { apiErrorMessage } from '@/lib/api'
import type { Deployment } from '@/types/api'
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

watch(open, (isOpen) => {
  if (isOpen) {
    sourceBranch.value = props.defaultBranch ?? ''
    mergeBranches.value = []
    advanced.value = false
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

async function onDeploy() {
  const source = sourceBranch.value || props.defaultBranch || undefined
  const merges = mergeBranches.value
  try {
    const dep = await createDeployment.mutateAsync({
      sourceBranch: source,
      mergeBranches: merges.length ? merges : undefined,
    })
    toast.success(
      merges.length
        ? `Deploying ${source} + ${merges.length} merged branch${merges.length === 1 ? '' : 'es'}`
        : 'Deployment queued',
    )
    open.value = false
    emit('deployed', dep)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not start deployment'))
  }
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
              <RefreshCw class="size-3.5" :class="{ 'animate-spin': branchesQuery.isRefreshing.value }" />
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
</template>

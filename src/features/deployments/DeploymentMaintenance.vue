<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { Check, LoaderCircle, Play, Wrench, X } from '@lucide/vue'
import { useDeploymentActions } from './deployments.queries'
import { useDeploymentAction } from './useDeploymentAction'
import AnsiLine from './AnsiLine.vue'
import type { MaintenanceActionDef } from '@/types/api'
import { Button } from '@/components/ui/button'
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

const props = defineProps<{ deploymentId: string }>()

const { data: actionDefs } = useDeploymentActions(() => props.deploymentId)
const maintenanceActions = computed(() => actionDefs.value ?? [])

const maint = useDeploymentAction(() => props.deploymentId)
const maintStatus = maint.status
const maintLines = maint.lines
const maintExitCode = maint.exitCode
const maintError = maint.errorMessage
const maintAction = maint.activeAction

// The /deployments/:id route reuses this component on a param change, so the
// composable's state would otherwise carry the prior deployment's run.
watch(
  () => props.deploymentId,
  () => maint.reset(),
)

function runMaintenance(action: MaintenanceActionDef) {
  void maint.run(action)
}

const maintLogEl = ref<HTMLElement | null>(null)
watch(
  () => maintLines.value.length,
  async () => {
    await nextTick()
    if (maintLogEl.value) maintLogEl.value.scrollTop = maintLogEl.value.scrollHeight
  },
)
</script>

<template>
  <section v-if="maintenanceActions.length" class="mt-6">
    <h2 class="flex items-center gap-1.5 text-sm font-semibold tracking-tight text-foreground">
      <Wrench class="size-3.5 text-muted-foreground" />
      Maintenance
    </h2>
    <div class="mt-3 flex flex-wrap gap-2">
      <template v-for="action in maintenanceActions" :key="action.id">
        <AlertDialog v-if="action.destructive">
          <AlertDialogTrigger as-child>
            <Button variant="outline" size="sm" :disabled="maintStatus === 'running'">
              <Play />
              {{ action.label }}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Run “{{ action.label }}”?</AlertDialogTitle>
              <AlertDialogDescription>
                This runs against the live
                <span class="font-mono">{{ action.service }}</span> container and may change
                application or database state.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="runMaintenance(action)">Run</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          v-else
          variant="outline"
          size="sm"
          :disabled="maintStatus === 'running'"
          @click="runMaintenance(action)"
        >
          <Play />
          {{ action.label }}
        </Button>
      </template>
    </div>

    <div v-if="maintStatus !== 'idle'" class="mt-3 overflow-hidden rounded-xl border border-border">
      <div
        class="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-2.5"
      >
        <div class="flex min-w-0 items-center gap-2">
          <LoaderCircle
            v-if="maintStatus === 'running'"
            class="size-4 shrink-0 animate-spin text-primary"
          />
          <Check v-else-if="maintStatus === 'succeeded'" class="size-4 shrink-0 text-success" />
          <X v-else class="size-4 shrink-0 text-destructive" />
          <span class="truncate text-sm font-medium text-foreground">
            {{ maintAction?.label }}
          </span>
          <span class="shrink-0 font-mono text-xs text-muted-foreground">
            {{ maintAction?.service }}
          </span>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <span
            v-if="maintStatus !== 'running'"
            class="text-xs font-medium"
            :class="maintStatus === 'succeeded' ? 'text-success' : 'text-destructive'"
          >
            {{ maintExitCode != null ? `exit ${maintExitCode}` : 'failed' }}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            class="text-muted-foreground hover:text-foreground"
            title="Clear"
            @click="maint.reset()"
          >
            <X />
          </Button>
        </div>
      </div>
      <div
        ref="maintLogEl"
        class="log-pane h-64 overflow-auto p-4 font-mono text-xs leading-relaxed"
      >
        <p v-if="maintError" class="text-destructive">{{ maintError }}</p>
        <p v-else-if="maintLines.length === 0 && maintStatus === 'running'" class="log-dim">
          Running…
        </p>
        <div v-for="(line, i) in maintLines" :key="i" class="whitespace-pre-wrap wrap-break-word">
          <AnsiLine :text="line" />
        </div>
      </div>
    </div>
  </section>
</template>

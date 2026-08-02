<script setup lang="ts">
import { ref } from 'vue'
import { HardDrive, LoaderCircle, Trash2 } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useDeleteVolume, useVolumes } from './volumes.queries'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
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

const props = defineProps<{ envId: string }>()

const { data: volumes, isPending, isError } = useVolumes(() => props.envId)
const del = useDeleteVolume(() => props.envId)

const deleting = ref<string | null>(null)

function formatSize(bytes: number): string {
  if (bytes < 0) return 'size unknown'
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

async function onDelete(name: string) {
  deleting.value = name
  try {
    await del.mutateAsync(name)
    toast.success(`Deleted volume ${name}`)
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not delete volume'))
  } finally {
    deleting.value = null
  }
}
</script>

<template>
  <section>
    <h2 class="text-sm font-semibold tracking-tight text-foreground">
      Volumes
      <span v-if="volumes?.length" class="ml-1 text-muted-foreground/60">{{ volumes.length }}</span>
    </h2>
    <p class="mt-1 text-xs text-muted-foreground">
      Storage that outlives a redeploy. Declare which paths are persisted in the project's build
      settings; what actually exists on disk is listed here. Deleting is mainly for reclaiming a
      volume you no longer declare — one still attached to a deployment can't be removed.
    </p>

    <div v-if="isPending" class="mt-3 space-y-2">
      <Skeleton v-for="n in 2" :key="n" class="h-12 w-full rounded-lg" />
    </div>

    <p v-else-if="isError" class="mt-3 text-sm text-destructive">Could not load volumes.</p>

    <p v-else-if="!volumes || volumes.length === 0" class="mt-3 text-xs text-muted-foreground">
      No volumes yet — one is created the first time you deploy with a volume declared.
    </p>

    <div
      v-else
      class="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border"
    >
      <div
        v-for="v in volumes"
        :key="v.volume"
        class="flex items-center gap-3 bg-card px-4 py-3"
      >
        <HardDrive class="size-4 shrink-0 text-muted-foreground" />
        <div class="min-w-0 flex-1">
          <div class="truncate font-mono text-sm text-foreground">{{ v.name }}</div>
          <div class="truncate font-mono text-xs text-muted-foreground">{{ v.volume }}</div>
        </div>
        <span class="shrink-0 font-mono text-xs text-muted-foreground">
          {{ formatSize(v.sizeBytes) }}
        </span>
        <span
          v-if="v.inUse"
          class="shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
          title="Attached to a container — cannot be deleted until no deployment uses it"
        >
          attached
        </span>

        <AlertDialog>
          <AlertDialogTrigger as-child>
            <Button
              size="icon-sm"
              variant="ghost"
              class="shrink-0 text-muted-foreground hover:text-destructive"
              :disabled="deleting === v.name"
              title="Delete volume"
            >
              <LoaderCircle v-if="deleting === v.name" class="animate-spin" />
              <Trash2 v-else />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete volume {{ v.name }}?</AlertDialogTitle>
              <AlertDialogDescription>
                Everything stored in this volume is destroyed and cannot be recovered. If it is
                still declared in build settings, the next deploy creates it again, empty.
                <template v-if="v.inUse">
                  It is still attached to a container, so this will be refused until no deployment
                  uses it.
                </template>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction @click="onDelete(v.name)">Delete volume</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  </section>
</template>

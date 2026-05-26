<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle, Plus, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useUpdateProject } from './projects.queries'
import { apiErrorMessage } from '@/lib/api'
import type { BuildConfig, Project } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{ project: Project }>()
const open = defineModel<boolean>('open', { required: true })

const updateProject = useUpdateProject(() => props.project.id)

type StrategyChoice = 'auto' | 'dockerfile' | 'compose' | 'sandbox-yml'
const STRATEGIES: { value: StrategyChoice; label: string }[] = [
  { value: 'auto', label: 'Auto-detect' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'compose', label: 'Compose' },
  { value: 'sandbox-yml', label: 'sandbox.yml' },
]

const strategy = ref<StrategyChoice>('auto')
const web = ref('')
// cmd / dbMigrate are argv arrays; edited as a single line, split on whitespace.
const cmdText = ref('')
const dbMigrateText = ref('')
const envRows = ref<{ key: string; value: string }[]>([])
const saving = ref(false)

function seedFromProject() {
  const bc = props.project.buildConfig ?? {}
  strategy.value = bc.strategy ?? 'auto'
  web.value = bc.web ?? ''
  cmdText.value = (bc.cmd ?? []).join(' ')
  dbMigrateText.value = (bc.dbMigrate ?? []).join(' ')
  envRows.value = Object.entries(bc.envs ?? {}).map(([key, value]) => ({ key, value }))
}

watch(open, (isOpen) => {
  if (isOpen) seedFromProject()
})

function addEnvRow() {
  envRows.value.push({ key: '', value: '' })
}
function removeEnvRow(i: number) {
  envRows.value.splice(i, 1)
}

// buildConfig is replaced wholesale on PATCH — assemble the complete object,
// omitting empty fields so the API's .strict() schema stays happy.
function assemble(): BuildConfig {
  const bc: BuildConfig = {}
  if (strategy.value !== 'auto') bc.strategy = strategy.value
  if (web.value.trim()) bc.web = web.value.trim()
  const cmd = cmdText.value.trim().split(/\s+/).filter(Boolean)
  if (cmd.length) bc.cmd = cmd
  const dbMigrate = dbMigrateText.value.trim().split(/\s+/).filter(Boolean)
  if (dbMigrate.length) bc.dbMigrate = dbMigrate
  const envs: Record<string, string> = {}
  for (const { key, value } of envRows.value) {
    if (key.trim()) envs[key.trim()] = value
  }
  if (Object.keys(envs).length) bc.envs = envs
  return bc
}

async function onSave() {
  saving.value = true
  try {
    await updateProject.mutateAsync({ buildConfig: assemble() })
    toast.success('Build settings saved')
    open.value = false
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not save settings'))
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Build settings</DialogTitle>
        <DialogDescription>
          How Lighthouse builds and runs
          <span class="font-medium text-foreground">{{ project.name }}</span>.
        </DialogDescription>
      </DialogHeader>

      <div class="grid max-h-[60vh] gap-5 overflow-y-auto py-1 pr-1">
        <!-- strategy -->
        <div class="grid gap-2">
          <Label>Build strategy</Label>
          <div class="grid grid-cols-2 gap-2">
            <button
              v-for="s in STRATEGIES"
              :key="s.value"
              type="button"
              :class="[
                'rounded-lg border px-3 py-2 text-sm transition-colors',
                strategy === s.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40',
              ]"
              @click="strategy = s.value"
            >
              {{ s.label }}
            </button>
          </div>
          <p class="text-xs text-muted-foreground">
            Auto-detect picks Dockerfile, then compose, then sandbox.yml from the repo.
          </p>
        </div>

        <!-- web service -->
        <div class="grid gap-2">
          <Label for="bc-web">Web service <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="bc-web" v-model="web" placeholder="web" class="font-mono text-sm" />
          <p class="text-xs text-muted-foreground">
            Which compose service receives traffic. Defaults to the heuristic.
          </p>
        </div>

        <!-- run command -->
        <div class="grid gap-2">
          <Label for="bc-cmd">Run command <span class="text-muted-foreground">(optional)</span></Label>
          <Input
            id="bc-cmd"
            v-model="cmdText"
            placeholder="node server.js"
            class="font-mono text-sm"
          />
          <p class="text-xs text-muted-foreground">Overrides the image's default command.</p>
        </div>

        <!-- migrate command -->
        <div class="grid gap-2">
          <Label for="bc-migrate">
            Migrate command <span class="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bc-migrate"
            v-model="dbMigrateText"
            placeholder="npx prisma migrate deploy"
            class="font-mono text-sm"
          />
          <p class="text-xs text-muted-foreground">
            Run against a managed database when "Run migrations" is enabled on it.
          </p>
        </div>

        <!-- env vars -->
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <Label>Environment variables</Label>
            <Button type="button" variant="ghost" size="sm" @click="addEnvRow">
              <Plus />
              Add
            </Button>
          </div>
          <div v-if="envRows.length === 0" class="text-xs text-muted-foreground">
            No variables set.
          </div>
          <div v-for="(row, i) in envRows" :key="i" class="flex items-center gap-2">
            <Input v-model="row.key" placeholder="KEY" class="font-mono text-sm" />
            <Input v-model="row.value" placeholder="value" class="font-mono text-sm" />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              class="shrink-0 text-muted-foreground"
              title="Remove"
              @click="removeEnvRow(i)"
            >
              <X />
            </Button>
          </div>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="saving" @click="open = false">
          Cancel
        </Button>
        <Button type="button" :disabled="saving" @click="onSave">
          <LoaderCircle v-if="saving" class="animate-spin" />
          Save changes
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

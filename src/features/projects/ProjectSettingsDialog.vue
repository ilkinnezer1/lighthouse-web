<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ChevronDown, ChevronUp, LoaderCircle, Plus, X } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useUpdateProject } from './projects.queries'
import { apiErrorMessage } from '@/lib/api'
import type {
  BuildConfig,
  BuildStrategy,
  MaintenanceActionConfig,
  Project,
  SetupStep,
} from '@/types/api'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

type StrategyChoice = 'auto' | BuildStrategy
const STRATEGIES: { value: StrategyChoice; label: string; hint: string }[] = [
  {
    value: 'auto',
    label: 'Auto-detect',
    hint: 'Compose file, then Dockerfile, then a generated Dockerfile.',
  },
  { value: 'dockerfile', label: 'Dockerfile', hint: "Builds the repo's own Dockerfile." },
  { value: 'compose', label: 'Compose', hint: 'Builds every service in the compose file.' },
  {
    value: 'generated',
    label: 'Generated',
    hint: 'Lighthouse writes a version-matched Dockerfile for you.',
  },
  { value: 'nixpacks', label: 'Nixpacks', hint: 'Zero-config builder, no Dockerfile needed.' },
  {
    value: 'buildpacks',
    label: 'Buildpacks',
    hint: 'Cloud Native Buildpacks, built by Heroku or Paketo.',
  },
  { value: 'railpack', label: 'Railpack', hint: "Nixpacks' successor — builds with BuildKit." },
  {
    value: 'image',
    label: 'Prebuilt image',
    hint: 'Pulls a registry image — no clone, no build.',
  },
]

// The builders that compile from source; only these read the build/start
// command, runtime version and root directory.
const SOURCE_BUILD: StrategyChoice[] = ['auto', 'generated', 'nixpacks', 'buildpacks', 'railpack']

type BuilderChoice = 'heroku' | 'paketo' | 'custom'
const BUILDERS: { value: BuilderChoice; label: string }[] = [
  { value: 'heroku', label: 'Heroku' },
  { value: 'paketo', label: 'Paketo' },
  { value: 'custom', label: 'Custom' },
]

const strategy = ref<StrategyChoice>('auto')
const builderChoice = ref<BuilderChoice>('heroku')
const builderImage = ref('')
const buildpacksText = ref('')
const buildCommand = ref('')
const startCommand = ref('')
const runtimeVersion = ref('')
const rootDir = ref('')

const image = ref('')
const port = ref('')
const cpuLimit = ref('')
const memoryMb = ref('')

const strategyHint = computed(
  () => STRATEGIES.find((s) => s.value === strategy.value)?.hint ?? '',
)
const showSourceFields = computed(() => SOURCE_BUILD.includes(strategy.value))
const showBuilder = computed(() => strategy.value === 'buildpacks')
const showImage = computed(() => strategy.value === 'image')
// Compose services get their limits from the compose file's own deploy.resources.
const showLimits = computed(() => strategy.value !== 'compose')
const web = ref('')
// cmd / dbMigrate are argv arrays; edited as a single line, split on whitespace.
const cmdText = ref('')
const dbMigrateText = ref('')
const envRows = ref<{ key: string; value: string }[]>([])
// Maintenance actions keep their stored id so the deployment "Run" buttons stay
// stable across edits; new rows get an id derived from the label at save time.
type MaintRow = { id: string; label: string; service: string; command: string; destructive: boolean }
const maintRows = ref<MaintRow[]>([])
const composePath = ref('')
// `advanced` reveals the per-step image/docker controls; not persisted.
type SetupRow = { command: string; image: string; docker: boolean; advanced: boolean }
const setupRows = ref<SetupRow[]>([])
const saving = ref(false)

function seedFromProject() {
  const bc = props.project.buildConfig ?? {}
  strategy.value = bc.strategy ?? 'auto'
  const builder = bc.builder ?? ''
  builderChoice.value =
    builder === 'paketo' ? 'paketo' : builder && builder !== 'heroku' ? 'custom' : 'heroku'
  builderImage.value = builderChoice.value === 'custom' ? builder : ''
  buildpacksText.value = (bc.buildpacks ?? []).join(' ')
  image.value = bc.image ?? ''
  port.value = bc.port ? String(bc.port) : ''
  cpuLimit.value = bc.cpuLimit ? String(bc.cpuLimit) : ''
  memoryMb.value = bc.memoryMb ? String(bc.memoryMb) : ''
  buildCommand.value = bc.buildCommand ?? ''
  startCommand.value = bc.startCommand ?? ''
  runtimeVersion.value = bc.runtimeVersion ?? ''
  rootDir.value = bc.rootDir ?? ''
  web.value = bc.web ?? ''
  cmdText.value = (bc.cmd ?? []).join(' ')
  dbMigrateText.value = (bc.dbMigrate ?? []).join(' ')
  envRows.value = Object.entries(bc.envs ?? {}).map(([key, value]) => ({ key, value }))
  maintRows.value = (bc.maintenanceActions ?? []).map((a) => ({
    id: a.id,
    label: a.label,
    service: a.service,
    command: a.command,
    destructive: a.destructive ?? false,
  }))
  composePath.value = bc.composePath ?? ''
  setupRows.value = (bc.setupSteps ?? []).map((s) => ({
    command: s.command,
    image: s.image ?? '',
    docker: s.docker ?? false,
    advanced: !!(s.image || s.docker),
  }))
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

function addMaintRow() {
  maintRows.value.push({ id: '', label: '', service: '', command: '', destructive: false })
}
function removeMaintRow(i: number) {
  maintRows.value.splice(i, 1)
}

function addSetupRow() {
  setupRows.value.push({ command: '', image: '', docker: false, advanced: false })
}
function removeSetupRow(i: number) {
  setupRows.value.splice(i, 1)
}
function moveSetupRow(i: number, delta: number) {
  const j = i + delta
  if (j < 0 || j >= setupRows.value.length) return
  const rows = setupRows.value
  ;[rows[i], rows[j]] = [rows[j], rows[i]]
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
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

  // Keep only fully-specified rows; derive an id from the label for new rows and
  // keep ids unique so each action's Run button maps to exactly one command.
  const actions: MaintenanceActionConfig[] = []
  const usedIds = new Set<string>()
  for (const row of maintRows.value) {
    const label = row.label.trim()
    const service = row.service.trim()
    const command = row.command.trim()
    if (!label || !service || !command) continue
    const base = (row.id.trim() || slugify(label)) || 'action'
    let id = base
    for (let n = 2; usedIds.has(id); n++) id = `${base}-${n}`
    usedIds.add(id)
    const action: MaintenanceActionConfig = { id, label, service, command }
    if (row.destructive) action.destructive = true
    actions.push(action)
  }
  if (actions.length) bc.maintenanceActions = actions

  if (composePath.value.trim()) bc.composePath = composePath.value.trim()

  // Only persist knobs the selected strategy actually reads, so a hidden field
  // can never keep steering a build the user can no longer see.
  if (showSourceFields.value) {
    if (buildCommand.value.trim()) bc.buildCommand = buildCommand.value.trim()
    if (startCommand.value.trim()) bc.startCommand = startCommand.value.trim()
    if (runtimeVersion.value.trim()) bc.runtimeVersion = runtimeVersion.value.trim()
    if (rootDir.value.trim()) bc.rootDir = rootDir.value.trim()
  }
  if (showImage.value && image.value.trim()) bc.image = image.value.trim()
  const portNum = Number(port.value.trim())
  if (portNum > 0) bc.port = portNum
  if (showLimits.value) {
    const cpu = Number(cpuLimit.value.trim())
    const mem = Number(memoryMb.value.trim())
    if (cpu > 0) bc.cpuLimit = cpu
    if (mem > 0) bc.memoryMb = mem
  }
  if (showBuilder.value) {
    const builder =
      builderChoice.value === 'custom' ? builderImage.value.trim() : builderChoice.value
    if (builder) bc.builder = builder
    const buildpacks = buildpacksText.value.trim().split(/[\s,]+/).filter(Boolean)
    if (buildpacks.length) bc.buildpacks = buildpacks
  }

  // Keep only steps with a command; omit empty image/docker so the API's
  // .strict() per-step schema stays happy.
  const steps: SetupStep[] = []
  for (const row of setupRows.value) {
    const command = row.command.trim()
    if (!command) continue
    const step: SetupStep = { command }
    const image = row.image.trim()
    if (image) step.image = image
    if (row.docker) step.docker = true
    steps.push(step)
  }
  if (steps.length) bc.setupSteps = steps

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
          <Label>Build method</Label>
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
          <p class="text-xs text-muted-foreground">{{ strategyHint }}</p>
        </div>

        <!-- prebuilt image -->
        <div v-if="showImage" class="grid gap-2">
          <Label for="bc-image">Image</Label>
          <Input
            id="bc-image"
            v-model="image"
            placeholder="nginx:1.27 or ghcr.io/acme/app:sha-abc123"
            class="font-mono text-sm"
          />
          <Input v-model="port" placeholder="port the image listens on, e.g. 80" class="font-mono text-sm" />
          <p class="text-xs text-muted-foreground">
            Private registries use the Lighthouse host's Docker credentials.
          </p>
        </div>

        <!-- resource limits -->
        <div v-if="showLimits" class="grid gap-2">
          <Label>Resource limits <span class="text-muted-foreground">(optional)</span></Label>
          <div class="grid grid-cols-2 gap-2">
            <Input v-model="cpuLimit" placeholder="CPU cores, e.g. 0.5" class="font-mono text-sm" />
            <Input v-model="memoryMb" placeholder="Memory MB, e.g. 512" class="font-mono text-sm" />
          </div>
          <p class="text-xs text-muted-foreground">
            Left blank, the container runs unconstrained. A container that exceeds its memory
            limit is killed by Docker.
          </p>
        </div>

        <!-- buildpacks builder -->
        <div v-if="showBuilder" class="grid gap-2">
          <Label>Builder</Label>
          <div class="grid grid-cols-3 gap-2">
            <button
              v-for="b in BUILDERS"
              :key="b.value"
              type="button"
              :class="[
                'rounded-lg border px-3 py-2 text-sm transition-colors',
                builderChoice === b.value
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:border-muted-foreground/40',
              ]"
              @click="builderChoice = b.value"
            >
              {{ b.label }}
            </button>
          </div>
          <Input
            v-if="builderChoice === 'custom'"
            v-model="builderImage"
            placeholder="ghcr.io/acme/builder:latest"
            class="font-mono text-sm"
          />
          <Input
            v-model="buildpacksText"
            placeholder="extra buildpacks, e.g. paketo-buildpacks/nodejs"
            class="font-mono text-sm"
          />
          <p class="text-xs text-muted-foreground">
            Heroku reads your repo's version files; Paketo takes the runtime version below.
          </p>
        </div>

        <!-- from-source build knobs -->
        <div v-if="showSourceFields" class="grid gap-2">
          <Label for="bc-build-cmd">
            Build &amp; start <span class="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bc-build-cmd"
            v-model="buildCommand"
            placeholder="build command, e.g. npm run build"
            class="font-mono text-sm"
          />
          <Input
            v-model="startCommand"
            placeholder="start command, e.g. node server.js"
            class="font-mono text-sm"
          />
          <div class="grid grid-cols-2 gap-2">
            <Input
              v-model="runtimeVersion"
              placeholder="runtime version, e.g. 20"
              class="font-mono text-sm"
            />
            <Input
              v-model="rootDir"
              placeholder="root dir, e.g. apps/api"
              class="font-mono text-sm"
            />
          </div>
        </div>

        <!-- setup steps -->
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <Label>Setup steps</Label>
            <Button type="button" variant="ghost" size="sm" @click="addSetupRow">
              <Plus />
              Add
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            Runs after clone, before build, with your environment variables and files available. A
            failed step fails the deploy.
          </p>
          <div v-if="setupRows.length === 0" class="text-xs text-muted-foreground">
            No setup steps.
          </div>
          <div
            v-for="(row, i) in setupRows"
            :key="i"
            class="grid gap-2 rounded-lg border border-border p-3"
          >
            <div class="flex items-center gap-2">
              <div class="flex shrink-0 flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-5 text-muted-foreground"
                  title="Move up"
                  :disabled="i === 0"
                  @click="moveSetupRow(i, -1)"
                >
                  <ChevronUp />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  class="size-5 text-muted-foreground"
                  title="Move down"
                  :disabled="i === setupRows.length - 1"
                  @click="moveSetupRow(i, 1)"
                >
                  <ChevronDown />
                </Button>
              </div>
              <Input
                v-model="row.command"
                placeholder="make setup"
                class="font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="shrink-0 text-muted-foreground"
                title="Remove"
                @click="removeSetupRow(i)"
              >
                <X />
              </Button>
            </div>
            <button
              type="button"
              class="w-fit text-xs text-muted-foreground transition-colors hover:text-foreground"
              @click="row.advanced = !row.advanced"
            >
              {{ row.advanced ? 'Hide advanced' : 'Advanced' }}
            </button>
            <div v-if="row.advanced" class="grid gap-2 pl-1">
              <Input
                v-model="row.image"
                placeholder="image with your script's tools, default alpine"
                class="font-mono text-sm"
              />
              <label class="flex items-center gap-2 text-xs text-muted-foreground">
                <Checkbox v-model="row.docker" />
                Script needs Docker
              </label>
            </div>
          </div>
        </div>

        <!-- compose file path -->
        <div class="grid gap-2">
          <Label for="bc-compose">
            Compose file path <span class="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="bc-compose"
            v-model="composePath"
            placeholder="docker-compose.yml"
            class="font-mono text-sm"
          />
          <p class="text-xs text-muted-foreground">
            e.g. docker/.docker-compose.yml if your compose isn't at the repo root.
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

        <!-- maintenance actions -->
        <div class="grid gap-2">
          <div class="flex items-center justify-between">
            <Label>Maintenance actions</Label>
            <Button type="button" variant="ghost" size="sm" @click="addMaintRow">
              <Plus />
              Add
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            One-click commands shown on each deployment. The command runs in the named service's
            live container; the value stays server-side and is never sent to the browser.
          </p>
          <div v-if="maintRows.length === 0" class="text-xs text-muted-foreground">
            No actions set.
          </div>
          <div
            v-for="(row, i) in maintRows"
            :key="i"
            class="grid gap-2 rounded-lg border border-border p-3"
          >
            <div class="flex items-center gap-2">
              <Input v-model="row.label" placeholder="Label (e.g. Run migrations)" class="text-sm" />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                class="shrink-0 text-muted-foreground"
                title="Remove"
                @click="removeMaintRow(i)"
              >
                <X />
              </Button>
            </div>
            <Input v-model="row.service" placeholder="service (e.g. web)" class="font-mono text-sm" />
            <Input
              v-model="row.command"
              placeholder="command (e.g. php artisan migrate --force)"
              class="font-mono text-sm"
            />
            <label class="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox v-model="row.destructive" />
              Confirm before running (destructive)
            </label>
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

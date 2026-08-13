import { computed, ref } from 'vue'
import type {
  BuildConfig,
  BuildStrategy,
  MaintenanceActionConfig,
  Project,
  SetupStep,
  VolumeConfig,
} from '@/types/api'

export type StrategyChoice = 'auto' | BuildStrategy
export type BuilderChoice = 'heroku' | 'paketo' | 'custom'

export interface VolumeRow {
  name: string
  path: string
}
export interface EnvRow {
  key: string
  value: string
}
// Maintenance actions keep their stored id so the deployment "Run" buttons stay
// stable across edits; new rows get an id derived from the label at save time.
export interface MaintRow {
  id: string
  label: string
  service: string
  command: string
  destructive: boolean
}
// `advanced` reveals the per-step image/docker controls; not persisted.
export interface SetupRow {
  command: string
  image: string
  docker: boolean
  advanced: boolean
}

export const STRATEGIES: { value: StrategyChoice; label: string; hint: string }[] = [
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

export const BUILDERS: { value: BuilderChoice; label: string }[] = [
  { value: 'heroku', label: 'Heroku' },
  { value: 'paketo', label: 'Paketo' },
  { value: 'custom', label: 'Custom' },
]

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function useBuildConfigForm(project: () => Project) {
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

  const web = ref('')
  // cmd / dbMigrate are argv arrays; edited as a single line, split on whitespace.
  const cmdText = ref('')
  const dbMigrateText = ref('')
  const composePath = ref('')

  const volumeRows = ref<VolumeRow[]>([])
  const envRows = ref<EnvRow[]>([])
  const maintRows = ref<MaintRow[]>([])
  const setupRows = ref<SetupRow[]>([])

  const showSourceFields = computed(() => SOURCE_BUILD.includes(strategy.value))
  const showBuilder = computed(() => strategy.value === 'buildpacks')
  const showImage = computed(() => strategy.value === 'image')
  // Compose services get their limits from the compose file's own deploy.resources.
  const showLimits = computed(() => strategy.value !== 'compose')
  const showVolumes = computed(() => strategy.value !== 'compose')

  function seedFromProject() {
    const bc = project().buildConfig ?? {}
    strategy.value = bc.strategy ?? 'auto'
    const builder = bc.builder ?? ''
    builderChoice.value =
      builder === 'paketo' ? 'paketo' : builder && builder !== 'heroku' ? 'custom' : 'heroku'
    builderImage.value = builderChoice.value === 'custom' ? builder : ''
    buildpacksText.value = (bc.buildpacks ?? []).join(' ')
    volumeRows.value = (bc.volumes ?? []).map((v) => ({ name: v.name, path: v.path }))
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
      const base = row.id.trim() || slugify(label) || 'action'
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
    // Keep only fully-specified rows so a half-typed volume can't fail the save.
    const volumes: VolumeConfig[] = []
    for (const row of volumeRows.value) {
      const name = row.name.trim()
      const path = row.path.trim()
      if (name && path) volumes.push({ name, path })
    }
    if (volumes.length) bc.volumes = volumes

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
      const buildpacks = buildpacksText.value
        .trim()
        .split(/[\s,]+/)
        .filter(Boolean)
      if (buildpacks.length) bc.buildpacks = buildpacks
    }

    // Keep only steps with a command; omit empty image/docker so the API's
    // .strict() per-step schema stays happy.
    const steps: SetupStep[] = []
    for (const row of setupRows.value) {
      const command = row.command.trim()
      if (!command) continue
      const step: SetupStep = { command }
      const stepImage = row.image.trim()
      if (stepImage) step.image = stepImage
      if (row.docker) step.docker = true
      steps.push(step)
    }
    if (steps.length) bc.setupSteps = steps

    return bc
  }

  return {
    strategy,
    builderChoice,
    builderImage,
    buildpacksText,
    buildCommand,
    startCommand,
    runtimeVersion,
    rootDir,
    image,
    port,
    cpuLimit,
    memoryMb,
    web,
    cmdText,
    dbMigrateText,
    composePath,
    volumeRows,
    envRows,
    maintRows,
    setupRows,
    showSourceFields,
    showBuilder,
    showImage,
    showLimits,
    showVolumes,
    seedFromProject,
    assemble,
  }
}

<script setup lang="ts">
import { ref, watch } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useUpdateProject } from './projects.queries'
import { BUILDERS, useBuildConfigForm } from './useBuildConfigForm'
import BuildMethodPicker from './BuildMethodPicker.vue'
import VolumeRowsEditor from './VolumeRowsEditor.vue'
import SetupStepsEditor from './SetupStepsEditor.vue'
import EnvRowsEditor from './EnvRowsEditor.vue'
import MaintenanceActionsEditor from './MaintenanceActionsEditor.vue'
import { apiErrorMessage } from '@/lib/api'
import type { Project } from '@/types/api'
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

const {
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
} = useBuildConfigForm(() => props.project)

const saving = ref(false)

watch(open, (isOpen) => {
  if (isOpen) seedFromProject()
})

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
          <span class="font-medium text-foreground">{{ project.name }}</span
          >.
        </DialogDescription>
      </DialogHeader>

      <div class="grid max-h-[60vh] gap-5 overflow-y-auto py-1 pr-1">
        <BuildMethodPicker v-model="strategy" />

        <!-- prebuilt image -->
        <div v-if="showImage" class="grid gap-2">
          <Label for="bc-image">Image</Label>
          <Input
            id="bc-image"
            v-model="image"
            placeholder="nginx:1.27 or ghcr.io/acme/app:sha-abc123"
            class="font-mono text-sm"
          />
          <Input
            v-model="port"
            placeholder="port the image listens on, e.g. 80"
            class="font-mono text-sm"
          />
          <p class="text-xs text-muted-foreground">
            Private registries use the Lighthouse host's Docker credentials.
          </p>
        </div>

        <VolumeRowsEditor v-if="showVolumes" v-model="volumeRows" />

        <!-- resource limits -->
        <div v-if="showLimits" class="grid gap-2">
          <Label>Resource limits <span class="text-muted-foreground">(optional)</span></Label>
          <div class="grid grid-cols-2 gap-2">
            <Input v-model="cpuLimit" placeholder="CPU cores, e.g. 0.5" class="font-mono text-sm" />
            <Input v-model="memoryMb" placeholder="Memory MB, e.g. 512" class="font-mono text-sm" />
          </div>
          <p class="text-xs text-muted-foreground">
            Left blank, the container runs unconstrained. A container that exceeds its memory limit
            is killed by Docker.
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

        <SetupStepsEditor v-model="setupRows" />

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
          <Label for="bc-web"
            >Web service <span class="text-muted-foreground">(optional)</span></Label
          >
          <Input id="bc-web" v-model="web" placeholder="web" class="font-mono text-sm" />
          <p class="text-xs text-muted-foreground">
            Which compose service receives traffic. Defaults to the heuristic.
          </p>
        </div>

        <!-- run command -->
        <div class="grid gap-2">
          <Label for="bc-cmd"
            >Run command <span class="text-muted-foreground">(optional)</span></Label
          >
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

        <EnvRowsEditor v-model="envRows" />

        <MaintenanceActionsEditor v-model="maintRows" />
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

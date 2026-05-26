<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { createDatabaseSchema } from './databases.schemas'
import { useCreateDatabase, useProjectDatabases } from './databases.queries'
import { useSnapshots } from './snapshots.queries'
import { apiErrorMessage } from '@/lib/api'
import { formatBytes } from '@/lib/utils'
import { relativeTime } from '@/lib/time'
import type {
  CreateDatabaseInput,
  CreateDatabaseMode,
  ManagedDatabase,
  Project,
} from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const props = defineProps<{ project: Project; envId: string }>()
const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [database: ManagedDatabase] }>()

const MODES: { value: CreateDatabaseMode; label: string; hint: string }[] = [
  { value: 'create-empty', label: 'Empty', hint: 'A fresh, empty database container.' },
  { value: 'attach-existing', label: 'Attach', hint: "Reuse another env's database connection." },
  { value: 'copy', label: 'Copy', hint: 'Clone a live Postgres database.' },
  { value: 'create-from-snapshot', label: 'From snapshot', hint: 'Seed from a Postgres snapshot.' },
]

const DB_TYPES = ['POSTGRES', 'MYSQL', 'REDIS', 'MONGO'] as const
const typeLabel: Record<(typeof DB_TYPES)[number], string> = {
  POSTGRES: 'PostgreSQL',
  MYSQL: 'MySQL',
  REDIS: 'Redis',
  MONGO: 'MongoDB',
}

const createDatabase = useCreateDatabase(() => props.envId)
const { handleSubmit, isSubmitting, resetForm, values, setFieldValue } = useForm({
  validationSchema: toTypedSchema(createDatabaseSchema),
})

const initialValues = {
  mode: 'create-empty',
  type: 'POSTGRES',
  version: '',
  name: '',
  runMigrate: false,
} as const

// Transient source-DB picker for the "from snapshot" mode (not part of the DTO).
const snapshotSourceDbId = ref('')

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm({ values: { ...initialValues } })
    snapshotSourceDbId.value = ''
  }
})

const mode = computed(() => values.mode as CreateDatabaseMode | undefined)
function selectMode(m: CreateDatabaseMode) {
  setFieldValue('mode', m)
}

// Candidate sources span every environment in the project.
const envIds = computed(() => props.project.environments?.map((e) => e.id) ?? [])
const projectDbs = useProjectDatabases(envIds)
const envName = (id: string) =>
  props.project.environments?.find((e) => e.id === id)?.name ?? 'unknown env'
const dbLabel = (db: ManagedDatabase) =>
  `${db.name} · ${db.type} ${db.version} · ${envName(db.environmentId)}`

// Attach: any READY db from another environment. Copy: READY Postgres anywhere.
const attachCandidates = computed(() =>
  projectDbs.value.databases.filter((d) => d.environmentId !== props.envId && d.status === 'READY'),
)
const copyCandidates = computed(() =>
  projectDbs.value.databases.filter((d) => d.type === 'POSTGRES' && d.status === 'READY'),
)
const snapshotDbCandidates = computed(() =>
  projectDbs.value.databases.filter((d) => d.type === 'POSTGRES'),
)

const { data: sourceSnapshots, isFetching: snapshotsFetching } = useSnapshots(snapshotSourceDbId, {
  enabled: computed(() => mode.value === 'create-from-snapshot' && !!snapshotSourceDbId.value),
})
const snapshotCandidates = computed(() =>
  (sourceSnapshots.value ?? []).filter((s) => s.status === 'READY'),
)
watch(snapshotSourceDbId, () => setFieldValue('snapshotId', ''))

const onSubmit = handleSubmit(async (v) => {
  let input: CreateDatabaseInput
  if (v.mode === 'create-empty') {
    input = {
      mode: 'create-empty',
      type: v.type,
      version: v.version,
      name: v.name,
      runMigrate: v.runMigrate || undefined,
    }
  } else if (v.mode === 'attach-existing') {
    input = { mode: 'attach-existing', databaseId: v.databaseId }
  } else if (v.mode === 'copy') {
    input = { mode: 'copy', sourceDatabaseId: v.sourceDatabaseId, name: v.name }
  } else {
    input = { mode: 'create-from-snapshot', snapshotId: v.snapshotId, name: v.name }
  }

  try {
    const database = await createDatabase.mutateAsync(input)
    toast.success(input.mode === 'attach-existing' ? 'Database attached' : 'Database provisioning')
    open.value = false
    emit('created', database)
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not create database'))
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Add database</DialogTitle>
        <DialogDescription>
          Provision a managed database for
          <span class="font-medium text-foreground">{{
            project.environments?.find((e) => e.id === envId)?.name ?? 'this environment'
          }}</span
          >.
        </DialogDescription>
      </DialogHeader>

      <!-- Mode selector -->
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="m in MODES"
          :key="m.value"
          type="button"
          :class="[
            'rounded-lg border p-3 text-left transition-colors',
            mode === m.value
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-muted-foreground/40',
          ]"
          @click="selectMode(m.value)"
        >
          <span class="block text-sm font-medium text-foreground">{{ m.label }}</span>
          <span class="mt-0.5 block text-xs text-muted-foreground">{{ m.hint }}</span>
        </button>
      </div>

      <form id="create-database" class="grid gap-4 py-1" novalidate @submit="onSubmit">
        <!-- create-empty -->
        <template v-if="mode === 'create-empty'">
          <div class="grid grid-cols-2 gap-4">
            <FormField v-slot="{ componentField }" name="type">
              <FormItem>
                <FormLabel>Engine</FormLabel>
                <Select v-bind="componentField">
                  <FormControl>
                    <SelectTrigger class="w-full"><SelectValue /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem v-for="t in DB_TYPES" :key="t" :value="t">
                      {{ typeLabel[t] }}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            </FormField>

            <FormField v-slot="{ componentField }" name="version">
              <FormItem>
                <FormLabel>Version</FormLabel>
                <FormControl>
                  <Input placeholder="16" class="font-mono text-sm" v-bind="componentField" />
                </FormControl>
                <FormMessage />
              </FormItem>
            </FormField>
          </div>

          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="primary" class="font-mono text-sm" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ value, handleChange }" name="runMigrate">
            <FormItem
              class="flex flex-row items-start gap-3 rounded-lg border border-border p-3"
            >
              <FormControl>
                <Checkbox :model-value="value" @update:model-value="handleChange" />
              </FormControl>
              <div class="space-y-1 leading-none">
                <FormLabel>Run migrations after provisioning</FormLabel>
                <FormDescription>
                  Requires the project build config to define a migrate command.
                </FormDescription>
              </div>
            </FormItem>
          </FormField>
        </template>

        <!-- attach-existing -->
        <template v-else-if="mode === 'attach-existing'">
          <FormField v-slot="{ componentField }" name="databaseId">
            <FormItem>
              <FormLabel>Source database</FormLabel>
              <Select v-bind="componentField" :disabled="attachCandidates.length === 0">
                <FormControl>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select a database" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem v-for="db in attachCandidates" :key="db.id" :value="db.id">
                    {{ dbLabel(db) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription v-if="attachCandidates.length === 0">
                No ready databases in other environments to attach.
              </FormDescription>
              <FormDescription v-else>
                Reuses the connection — no new container, no teardown on delete.
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <!-- copy -->
        <template v-else-if="mode === 'copy'">
          <FormField v-slot="{ componentField }" name="sourceDatabaseId">
            <FormItem>
              <FormLabel>Copy from</FormLabel>
              <Select v-bind="componentField" :disabled="copyCandidates.length === 0">
                <FormControl>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select a Postgres database" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem v-for="db in copyCandidates" :key="db.id" :value="db.id">
                    {{ dbLabel(db) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription v-if="copyCandidates.length === 0">
                No ready Postgres databases to copy.
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>New name</FormLabel>
              <FormControl>
                <Input placeholder="primary-copy" class="font-mono text-sm" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <!-- create-from-snapshot -->
        <template v-else-if="mode === 'create-from-snapshot'">
          <FormItem>
            <FormLabel>Source database</FormLabel>
            <Select v-model="snapshotSourceDbId" :disabled="snapshotDbCandidates.length === 0">
              <SelectTrigger class="w-full">
                <SelectValue placeholder="Select a Postgres database" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="db in snapshotDbCandidates" :key="db.id" :value="db.id">
                  {{ dbLabel(db) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription v-if="snapshotDbCandidates.length === 0">
              No Postgres databases with snapshots.
            </FormDescription>
          </FormItem>

          <FormField v-slot="{ componentField }" name="snapshotId">
            <FormItem>
              <FormLabel>Snapshot</FormLabel>
              <Select
                v-bind="componentField"
                :disabled="!snapshotSourceDbId || snapshotCandidates.length === 0"
              >
                <FormControl>
                  <SelectTrigger class="w-full">
                    <SelectValue placeholder="Select a snapshot" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem v-for="s in snapshotCandidates" :key="s.id" :value="s.id">
                    {{ relativeTime(s.createdAt) }} · {{ formatBytes(s.sizeBytes) }}
                  </SelectItem>
                </SelectContent>
              </Select>
              <FormDescription v-if="snapshotSourceDbId && snapshotsFetching">
                Loading snapshots…
              </FormDescription>
              <FormDescription v-else-if="snapshotSourceDbId && snapshotCandidates.length === 0">
                This database has no ready snapshots.
              </FormDescription>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="name">
            <FormItem>
              <FormLabel>New name</FormLabel>
              <FormControl>
                <Input placeholder="from-snapshot" class="font-mono text-sm" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>
      </form>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="isSubmitting" @click="open = false">
          Cancel
        </Button>
        <Button type="submit" form="create-database" :disabled="isSubmitting">
          <LoaderCircle v-if="isSubmitting" class="animate-spin" />
          Add database
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

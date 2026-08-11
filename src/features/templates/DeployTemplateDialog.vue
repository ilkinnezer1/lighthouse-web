<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { KeyRound, LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useInstantiateTemplate } from './templates.queries'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { apiErrorMessage } from '@/lib/api'
import type { TemplateSummary } from '@/types/api'
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

const props = defineProps<{ template: TemplateSummary | null }>()
const open = defineModel<boolean>('open', { required: true })

const router = useRouter()
const activeOrg = useActiveOrgStore()
const instantiate = useInstantiateTemplate()

const name = ref('')
const values = ref<Record<string, string>>({})

// Refill from the template every time the dialog opens, so reopening after a
// cancel never shows the previous app's answers.
watch(open, (isOpen) => {
  if (!isOpen || !props.template) return
  name.value = props.template.name
  values.value = Object.fromEntries(props.template.promptedEnv.map((f) => [f.key, f.default ?? '']))
})

const missing = computed(() =>
  (props.template?.promptedEnv ?? []).filter((f) => f.required && !values.value[f.key]?.trim()),
)
const canSubmit = computed(
  () => !!name.value.trim() && missing.value.length === 0 && !instantiate.isPending.value,
)

async function onSubmit() {
  const template = props.template
  if (!template || !canSubmit.value) return

  try {
    const result = await instantiate.mutateAsync({
      slug: template.slug,
      input: {
        name: name.value.trim(),
        organizationId: activeOrg.activeOrgId ?? undefined,
        env: values.value,
      },
    })
    open.value = false
    toast.success(`${template.name} is deploying`, {
      description: result.postInstall ?? result.url,
      duration: 10000,
    })
    await router.push(
      result.deploymentId
        ? `/deployments/${result.deploymentId}`
        : `/projects/${result.project.id}`,
    )
  } catch (e) {
    toast.error(apiErrorMessage(e, `Could not deploy ${template.name}`))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent v-if="template" class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Deploy {{ template.name }}</DialogTitle>
        <DialogDescription>
          Creates a project running
          <code class="font-mono text-ink-2">{{ template.image }}</code> and starts the first
          deployment.
        </DialogDescription>
      </DialogHeader>

      <div class="grid gap-4">
        <div class="grid gap-1.5">
          <Label for="tpl-name">Project name</Label>
          <Input id="tpl-name" v-model="name" :placeholder="template.name" />
        </div>

        <div v-for="field in template.promptedEnv" :key="field.key" class="grid gap-1.5">
          <Label :for="`tpl-${field.key}`">
            {{ field.label }}
            <span v-if="field.required" class="text-ink-4">· required</span>
          </Label>
          <Input
            :id="`tpl-${field.key}`"
            v-model="values[field.key]"
            :type="field.secret ? 'password' : 'text'"
            :placeholder="field.default"
          />
          <p v-if="field.description" class="text-xs text-ink-4">
            {{ field.description }}
          </p>
        </div>

        <!--
          Say plainly that secrets are made server-side. Users otherwise assume a
          blank field means "no password", and go looking for one to invent.
        -->
        <p
          v-if="template.generatedEnvCount > 0"
          class="flex items-start gap-2 rounded-md bg-sunken px-3 py-2.5 text-xs text-ink-3"
        >
          <KeyRound class="mt-px size-3.5 shrink-0 text-ink-4" />
          <span>
            {{ template.generatedEnvCount }}
            {{ template.generatedEnvCount === 1 ? 'secret is' : 'secrets are' }}
            generated on the server and stored encrypted. You can read them back under the
            environment's variables.
          </span>
        </p>

        <p v-if="template.postInstall" class="text-xs text-ink-4">
          {{ template.postInstall }}
        </p>
      </div>

      <DialogFooter>
        <Button variant="ghost" @click="open = false">Cancel</Button>
        <Button :disabled="!canSubmit" @click="onSubmit">
          <LoaderCircle v-if="instantiate.isPending.value" class="animate-spin" />
          Deploy
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { watch } from 'vue'
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { createProjectSchema } from './projects.schemas'
import { useCreateProject } from './projects.queries'
import { apiErrorMessage } from '@/lib/api'
import type { CreateProjectInput, Project } from '@/types/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const open = defineModel<boolean>('open', { required: true })
const emit = defineEmits<{ created: [project: Project] }>()

const createProject = useCreateProject()
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(createProjectSchema),
})

watch(open, (isOpen) => {
  if (isOpen) resetForm()
})

const onSubmit = handleSubmit(async (values) => {
  const input: CreateProjectInput = {
    name: values.name,
    repoUrl: values.repoUrl,
    subdomain: values.subdomain?.trim() || undefined,
    defaultBranch: values.defaultBranch?.trim() || undefined,
  }
  try {
    const project = await createProject.mutateAsync(input)
    toast.success('Project created')
    open.value = false
    emit('created', project)
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not create project'))
  }
})
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>New project</DialogTitle>
        <DialogDescription>
          Point Lighthouse at a public Git repository to deploy it.
        </DialogDescription>
      </DialogHeader>

      <form id="create-project" class="grid gap-4 py-2" novalidate @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="my-app" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="repoUrl">
          <FormItem>
            <FormLabel>Repository URL</FormLabel>
            <FormControl>
              <Input
                placeholder="https://github.com/owner/repo"
                class="font-mono text-sm"
                v-bind="componentField"
              />
            </FormControl>
            <FormDescription>Public repo. Must start with http(s).</FormDescription>
            <FormMessage />
          </FormItem>
        </FormField>

        <div class="grid grid-cols-2 gap-4">
          <FormField v-slot="{ componentField }" name="subdomain">
            <FormItem>
              <FormLabel>
                Subdomain
                <span class="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="auto" class="font-mono text-sm" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="defaultBranch">
            <FormItem>
              <FormLabel>
                Branch
                <span class="font-normal text-muted-foreground">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input placeholder="main" class="font-mono text-sm" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </div>
      </form>

      <DialogFooter>
        <Button variant="outline" type="button" :disabled="isSubmitting" @click="open = false">
          Cancel
        </Button>
        <Button type="submit" form="create-project" :disabled="isSubmitting">
          <LoaderCircle v-if="isSubmitting" class="animate-spin" />
          Create project
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

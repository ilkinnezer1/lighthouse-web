<script setup lang="ts">
import { useForm } from 'vee-validate'
import { toTypedSchema } from '@vee-validate/zod'
import { LoaderCircle, Plus } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useTemplateRef } from 'vue'
import { createGitCredentialSchema } from './integrations.schemas'
import { useCreateGitCredential } from './integrations.queries'
import {
  PUBLIC_REPO_NOTE,
  TOKEN_SOURCE_PATH,
  credentialTitle,
  toCreateInput,
} from './integrations.credentials'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

const create = useCreateGitCredential()
const { handleSubmit, isSubmitting, resetForm } = useForm({
  validationSchema: toTypedSchema(createGitCredentialSchema),
  initialValues: { token: '', label: '' },
})

const root = useTemplateRef<HTMLFormElement>('root')

function focus() {
  root.value?.querySelector('input')?.focus()
}

defineExpose({ focus })

const onSubmit = handleSubmit(async (values) => {
  try {
    const saved = await create.mutateAsync(toCreateInput(values))
    resetForm({ values: { token: '', label: '' } })
    toast.success(`Saved ${credentialTitle(saved)}`)
  } catch (error) {
    // GitHub's own verdict — invalid, already stored, unreachable. Rewording it
    // here would hide the one detail that says what to do next.
    toast.error(apiErrorMessage(error, 'Could not save the token'))
  }
})
</script>

<template>
  <form ref="root" class="rounded-lg bg-sunken p-4 sm:p-5" novalidate @submit="onSubmit">
    <p class="eyebrow">Add a token</p>

    <div class="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start">
      <FormField v-slot="{ componentField }" name="token">
        <FormItem class="min-w-0 flex-[3]">
          <FormLabel class="sr-only">Personal access token</FormLabel>
          <FormControl>
            <!-- Masked because it is a live secret on screen; the API never
                 returns it again, so nothing else on this page can reveal one. -->
            <Input
              type="password"
              autocomplete="off"
              spellcheck="false"
              placeholder="ghp_… or github_pat_…"
              class="font-mono"
              v-bind="componentField"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="label">
        <FormItem class="min-w-0 flex-[2]">
          <FormLabel class="sr-only">Label</FormLabel>
          <FormControl>
            <Input placeholder="Label (optional)" v-bind="componentField" />
          </FormControl>
          <FormMessage />
        </FormItem>
      </FormField>

      <Button type="submit" class="shrink-0" :disabled="isSubmitting">
        <LoaderCircle v-if="isSubmitting" class="animate-spin" />
        <Plus v-else />
        Save token
      </Button>
    </div>

    <p class="mt-3 text-xs leading-relaxed text-ink-3">
      Create one at <span class="text-ink-2">{{ TOKEN_SOURCE_PATH }}</span> with the
      <span class="font-mono text-ink-2">repo</span> scope ticked. {{ PUBLIC_REPO_NOTE }}
    </p>
  </form>
</template>

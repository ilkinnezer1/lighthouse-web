<script setup lang="ts">
import {ref} from 'vue'
import {useForm} from 'vee-validate'
import {toTypedSchema} from '@vee-validate/zod'
import {useRoute, useRouter, RouterLink} from 'vue-router'
import {LoaderCircle} from 'lucide-vue-next'
import AuthShell from './AuthShell.vue'
import {loginSchema} from './auth.schemas'
import {useAuthStore} from './auth.store'
import {apiErrorMessage} from '@/lib/api'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()
const serverError = ref<string | null>(null)

const {handleSubmit, isSubmitting} = useForm({
  validationSchema: toTypedSchema(loginSchema),
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = null
  try {
    await auth.login(values)
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    serverError.value = apiErrorMessage(error, 'Could not sign in.')
  }
})
</script>

<template>
  <AuthShell title="Sign in" subtitle="Welcome back to your Lighthouse.">
    <form class="grid gap-4" novalidate @submit="onSubmit">
      <FormField v-slot="{ componentField }" name="email">
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl>
            <Input
                type="email"
                placeholder="you@example.com"
                autocomplete="email"
                v-bind="componentField"
            />
          </FormControl>
          <FormMessage/>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="password">
        <FormItem>
          <FormLabel>Password</FormLabel>
          <FormControl>
            <Input
                type="password"
                placeholder="••••••••••••"
                autocomplete="current-password"
                v-bind="componentField"
            />
          </FormControl>
          <FormMessage/>
        </FormItem>
      </FormField>

      <p
          v-if="serverError"
          class="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
      >
        {{ serverError }}
      </p>

      <Button type="submit" class="mt-1 w-full" :disabled="isSubmitting">
        <LoaderCircle v-if="isSubmitting" class="animate-spin"/>
        Sign in
      </Button>
    </form>

    <template #footer>
      No account?
      <RouterLink to="/signup" class="font-medium text-primary hover:underline">
        Create one
      </RouterLink>
    </template>
  </AuthShell>
</template>

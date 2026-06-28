<script setup lang="ts">
import {ref} from 'vue'
import {useForm} from 'vee-validate'
import {toTypedSchema} from '@vee-validate/zod'
import {useRoute, useRouter, RouterLink} from 'vue-router'
import {LoaderCircle} from '@lucide/vue'
import AuthShell from './AuthShell.vue'
import {signupSchema} from './auth.schemas'
import {useAuthStore} from './auth.store'
import {apiErrorMessage} from '@/lib/api'
import {Button} from '@/components/ui/button'
import {Input} from '@/components/ui/input'
import {
  FormControl,
  FormDescription,
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
  validationSchema: toTypedSchema(signupSchema),
})

const onSubmit = handleSubmit(async (values) => {
  serverError.value = null
  try {
    await auth.signup({
      email: values.email,
      username: values.username,
      password: values.password,
      displayName: values.displayName?.trim() || undefined,
    })
    // Preserve a pending invite (or any deep link) routed through signup.
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    await router.replace(redirect)
  } catch (error) {
    serverError.value = apiErrorMessage(error, 'Could not create your account.')
  }
})
</script>

<template>
  <AuthShell title="Create account" subtitle="Set up your Lighthouse in a minute.">
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

      <FormField v-slot="{ componentField }" name="username">
        <FormItem>
          <FormLabel>Username</FormLabel>
          <FormControl>
            <Input
                type="text"
                placeholder="ada-lovelace"
                autocomplete="username"
                v-bind="componentField"
            />
          </FormControl>
          <FormDescription>Used in your deploy URLs.</FormDescription>
          <FormMessage/>
        </FormItem>
      </FormField>

      <FormField v-slot="{ componentField }" name="displayName">
        <FormItem>
          <FormLabel>
            Display name
            <span class="font-normal text-muted-foreground">(optional)</span>
          </FormLabel>
          <FormControl>
            <Input type="text" placeholder="Ada Lovelace" v-bind="componentField"/>
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
                placeholder="At least 12 characters"
                autocomplete="new-password"
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
        Create account
      </Button>
    </form>

    <template #footer>
      Already have an account?
      <RouterLink
        :to="{ name: 'login', query: route.query.redirect ? { redirect: route.query.redirect } : {} }"
        class="font-medium text-primary hover:underline"
      >
        Sign in
      </RouterLink>
    </template>
  </AuthShell>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { LoaderCircle, Trash2, TriangleAlert } from '@lucide/vue'
import { toast } from 'vue-sonner'
import {
  credentialSubtitle,
  credentialTitle,
  repoScopeDotClass,
  repoScopeNotice,
  scopeChips,
} from './integrations.credentials'
import { useDeleteGitCredential } from './integrations.queries'
import { apiErrorMessage } from '@/lib/api'
import { shortAgo } from '@/lib/time'
import type { GitCredentialView } from '@/types/api'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

const props = defineProps<{ credential: GitCredentialView }>()

const title = computed(() => credentialTitle(props.credential))
const subtitle = computed(() => credentialSubtitle(props.credential))
const notice = computed(() => repoScopeNotice(props.credential))
const dotClass = computed(() => repoScopeDotClass(props.credential))
const chips = computed(() => scopeChips(props.credential))

const remove = useDeleteGitCredential()

async function onDelete() {
  try {
    await remove.mutateAsync(props.credential.id)
    toast.success(`Removed ${title.value}`)
  } catch (error) {
    toast.error(apiErrorMessage(error, 'Could not remove the token'))
  }
}
</script>

<template>
  <div class="flex flex-wrap items-start gap-x-4 gap-y-2 py-4">
    <span
      class="mt-1.5 size-2 shrink-0 rounded-full"
      :class="dotClass"
      :title="notice?.text ?? 'Scopes not reported'"
    />

    <div class="min-w-0 flex-1">
      <p class="truncate text-sm text-ink-1">{{ title }}</p>
      <p v-if="subtitle" class="mt-0.5 truncate font-mono text-xs text-ink-4">{{ subtitle }}</p>

      <p
        v-if="notice"
        class="mt-1.5 flex items-start gap-1.5 text-xs"
        :class="notice.tone === 'warning' ? 'text-signal-error' : 'text-ink-3'"
      >
        <TriangleAlert v-if="notice.tone === 'warning'" class="mt-px size-3.5 shrink-0" />
        <span>{{ notice.text }}</span>
      </p>
    </div>

    <div v-if="chips.length" class="flex shrink-0 flex-wrap items-center gap-1.5">
      <span v-for="scope in chips" :key="scope" class="font-mono text-xs text-ink-4">
        [{{ scope }}]
      </span>
    </div>

    <span class="shrink-0 font-mono text-xs text-ink-4">{{ shortAgo(credential.createdAt) }}</span>

    <AlertDialog>
      <AlertDialogTrigger as-child>
        <Button
          variant="ghost"
          size="sm"
          class="-my-1 shrink-0 text-ink-4 hover:text-destructive"
          :aria-label="`Remove ${title}`"
        >
          <Trash2 />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove this token?</AlertDialogTitle>
          <AlertDialogDescription>
            Lighthouse forgets its copy of {{ title }}. Private repositories stop cloning until
            another token is saved, and public ones carry on unauthenticated. The token itself stays
            valid on GitHub — revoke it there if that is what you meant.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-white hover:bg-destructive/90"
            :disabled="remove.isPending.value"
            @click="onDelete"
          >
            <LoaderCircle v-if="remove.isPending.value" class="animate-spin" />
            Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>

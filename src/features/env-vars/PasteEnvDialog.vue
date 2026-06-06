<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { LoaderCircle } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { useMergeEnvVars, useReplaceEnvVars } from './env-vars.queries'
import { apiErrorMessage } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const props = defineProps<{ envId: string }>()
const open = defineModel<boolean>('open', { required: true })

const text = ref('')
const merge = useMergeEnvVars(() => props.envId)
const replace = useReplaceEnvVars(() => props.envId)
const pending = computed(() => merge.isPending.value || replace.isPending.value)

watch(open, (isOpen) => {
  if (isOpen) text.value = ''
})

async function apply(mode: 'merge' | 'replace') {
  const dotenv = text.value.trim()
  if (!dotenv) {
    toast.error('Paste a .env block first')
    return
  }
  try {
    await (mode === 'merge' ? merge : replace).mutateAsync({ dotenv })
    toast.success(mode === 'merge' ? 'Variables merged' : 'Variables replaced')
    open.value = false
  } catch (e) {
    toast.error(apiErrorMessage(e, 'Could not import variables'))
  }
}
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Paste .env</DialogTitle>
        <DialogDescription>
          One <span class="font-mono">KEY=value</span> per line. Comments and blank lines are
          ignored.
        </DialogDescription>
      </DialogHeader>

      <textarea
        v-model="text"
        rows="10"
        spellcheck="false"
        placeholder="DATABASE_URL=postgres://…&#10;STRIPE_KEY=sk_live_…"
        class="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 font-mono text-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />

      <DialogFooter class="gap-2 sm:justify-between">
        <Button
          variant="outline"
          type="button"
          class="text-destructive hover:text-destructive"
          :disabled="pending"
          @click="apply('replace')"
        >
          Replace all
        </Button>
        <div class="flex gap-2">
          <Button variant="outline" type="button" :disabled="pending" @click="open = false">
            Cancel
          </Button>
          <Button type="button" :disabled="pending" @click="apply('merge')">
            <LoaderCircle v-if="pending" class="animate-spin" />
            Merge
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

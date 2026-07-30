<script setup lang="ts">
import { RotateCcw } from '@lucide/vue'
import { Button } from '@/components/ui/button'

defineProps<{
  message: string
  retrying?: boolean
}>()

defineEmits<{ retry: [] }>()
</script>

<template>
  <!--
    Every failure looks the same and always offers the same way out. An error
    the user can't act on is just a dead end.
  -->
  <div role="alert" class="rounded-lg bg-destructive/8 px-6 py-12 text-center">
    <p class="text-sm text-destructive">{{ message }}</p>
    <Button variant="outline" size="sm" class="mt-4" :disabled="retrying" @click="$emit('retry')">
      <RotateCcw :class="retrying && 'animate-spin'" />
      {{ retrying ? 'Retrying…' : 'Try again' }}
    </Button>
  </div>
</template>

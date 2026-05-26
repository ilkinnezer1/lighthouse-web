<script setup lang="ts">
import { computed } from 'vue'
import { parseAnsi } from '@/lib/ansi'

const props = defineProps<{ text: string }>()
const segments = computed(() => parseAnsi(props.text))
</script>

<template><span v-for="(seg, i) in segments" :key="i" :style="seg.style">{{ seg.text }}</span></template>

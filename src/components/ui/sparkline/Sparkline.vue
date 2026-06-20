<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    values: number[]
    width?: number
    height?: number
  }>(),
  { width: 32, height: 12 },
)

// Pad the polyline inward by the stroke half-width so the line never clips at
// the box edges.
const PAD = 1

const points = computed(() => {
  const v = props.values
  if (v.length < 2) return ''

  const min = Math.min(...v)
  const max = Math.max(...v)
  // Epsilon keeps a flat/idle series centred as a calm line instead of
  // amplifying float noise into a full-height zigzag.
  const span = max - min < 1e-6 ? 1 : max - min

  const w = props.width - PAD * 2
  const h = props.height - PAD * 2
  const step = w / (v.length - 1)

  return v
    .map((n, i) => {
      const x = PAD + i * step
      const y = PAD + h - ((n - min) / span) * h
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
})
</script>

<template>
  <svg
    v-if="points"
    :width="width"
    :height="height"
    :viewBox="`0 0 ${width} ${height}`"
    class="inline-block align-middle"
    fill="none"
    aria-hidden="true"
  >
    <polyline
      :points="points"
      stroke="currentColor"
      stroke-width="1"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>

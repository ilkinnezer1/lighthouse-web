<script setup lang="ts">
import { ref } from 'vue'
import { ChevronRight, FileCode, FilePlus, Folder, FolderOpen } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { FileTreeNode } from './file-tree'

const props = defineProps<{ node: FileTreeNode; depth: number; selectedPath: string | null }>()
const emit = defineEmits<{ select: [path: string]; create: [folder: string] }>()

const open = ref(props.depth === 0)

function onClick() {
  if (props.node.type === 'dir') open.value = !open.value
  else emit('select', props.node.path)
}

function onCreate() {
  open.value = true
  emit('create', props.node.path)
}
</script>

<template>
  <div>
    <div
      :class="
        cn(
          'group flex items-center transition-colors hover:bg-accent/40',
          node.type === 'file' && selectedPath === node.path && 'bg-accent/60',
        )
      "
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 pr-2 text-left text-sm"
        :style="{ paddingLeft: `${depth * 14 + 8}px` }"
        @click="onClick"
      >
        <ChevronRight
          v-if="node.type === 'dir'"
          :class="
            cn('size-3.5 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')
          "
        />
        <span v-else class="w-3.5 shrink-0" />

        <component
          :is="node.type === 'dir' ? (open ? FolderOpen : Folder) : FileCode"
          :class="
            cn('size-4 shrink-0', node.type === 'dir' ? 'text-primary/80' : 'text-muted-foreground')
          "
        />
        <span class="flex-1 truncate font-mono text-xs text-foreground">{{ node.name }}</span>
        <Badge v-if="node.overridden" variant="secondary" class="px-1.5 py-0 text-[10px]">
          overridden
        </Badge>
      </button>

      <button
        v-if="node.type === 'dir'"
        type="button"
        :title="`New file in ${node.path}`"
        class="mr-1.5 grid size-6 shrink-0 place-items-center rounded text-muted-foreground opacity-0 transition hover:text-foreground focus-visible:opacity-100 group-hover:opacity-100"
        @click.stop="onCreate"
      >
        <FilePlus class="size-3.5" />
      </button>
    </div>

    <div v-if="node.type === 'dir' && open">
      <FileTreeNode
        v-for="child in node.children"
        :key="child.path"
        :node="child"
        :depth="depth + 1"
        :selected-path="selectedPath"
        @select="(p) => emit('select', p)"
        @create="(f) => emit('create', f)"
      />
    </div>
  </div>
</template>

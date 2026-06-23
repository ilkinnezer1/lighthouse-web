import type { ProjectFileEntry } from '@/types/api'

export interface FileTreeNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  overridden: boolean
  children: FileTreeNode[]
}

function parentPath(path: string): string | null {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? null : path.slice(0, slash)
}

function baseName(path: string): string {
  const slash = path.lastIndexOf('/')
  return slash === -1 ? path : path.slice(slash + 1)
}

export function buildFileTree(entries: ProjectFileEntry[]): FileTreeNode[] {
  const byPath = new Map<string, FileTreeNode>()

  const ensureDir = (path: string): FileTreeNode => {
    let node = byPath.get(path)
    if (!node) {
      node = { name: baseName(path), path, type: 'dir', size: 0, overridden: false, children: [] }
      byPath.set(path, node)
      const parent = parentPath(path)
      if (parent !== null) ensureDir(parent).children.push(node)
    }
    return node
  }

  for (const e of entries) {
    if (e.type === 'dir') {
      const node = ensureDir(e.path)
      node.overridden = e.overridden
      node.size = e.size
    }
  }

  const roots: FileTreeNode[] = []
  for (const e of entries) {
    if (e.type === 'file') {
      const node: FileTreeNode = { ...e, children: [] }
      const parent = parentPath(e.path)
      if (parent === null) roots.push(node)
      else ensureDir(parent).children.push(node)
    }
  }

  for (const node of byPath.values()) {
    if (parentPath(node.path) === null) roots.push(node)
  }

  sortNodes(roots)
  return roots
}

function sortNodes(nodes: FileTreeNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  for (const n of nodes) if (n.children.length) sortNodes(n.children)
}

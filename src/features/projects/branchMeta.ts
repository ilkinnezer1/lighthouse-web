import type { BranchMeta, RepoBranchWithMeta } from '@/types/api'

export function toBranchMetaMap(
  branches: RepoBranchWithMeta[] | undefined,
): Record<string, BranchMeta> {
  const out: Record<string, BranchMeta> = {}
  for (const b of branches ?? []) {
    out[b.name] = {
      aheadBy: b.aheadBy ?? null,
      behindBy: b.behindBy ?? null,
      lastCommitDate: b.lastCommitDate ?? null,
    }
  }
  return out
}

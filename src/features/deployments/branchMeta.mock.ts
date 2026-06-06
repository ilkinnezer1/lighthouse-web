import type { BranchMeta, RepoBranch } from '@/types/api'

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) >>> 0
  }
  return h
}

export function mockBranchMeta(
  branches: RepoBranch[],
  source: string,
): Record<string, BranchMeta> {
  const out: Record<string, BranchMeta> = {}
  for (const b of branches) {
    const h = hash(`${source}::${b.name}`)
    const hoursAgo = 1 + ((h >> 8) % (24 * 21))
    out[b.name] = {
      aheadBy: h % 18,
      behindBy: (h >> 5) % 5,
      lastCommitDate: new Date(Date.now() - hoursAgo * 3_600_000).toISOString(),
    }
  }
  return out
}

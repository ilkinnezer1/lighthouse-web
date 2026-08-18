import type { BranchIssue, BranchMeta, RepoBranchWithMeta } from '@/types/api'

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

// Branch name → the Jira issue it names, for callers that hold a stored branch
// (which snapshots key and title but not the site URL the link needs).
export function toBranchIssueMap(
  branches: RepoBranchWithMeta[] | undefined,
): Record<string, BranchIssue> {
  const out: Record<string, BranchIssue> = {}
  for (const b of branches ?? []) {
    if (!b.issueKey) continue
    out[b.name] = {
      issueKey: b.issueKey,
      issueTitle: b.issueTitle ?? null,
      issueUrl: b.issueUrl ?? null,
    }
  }
  return out
}

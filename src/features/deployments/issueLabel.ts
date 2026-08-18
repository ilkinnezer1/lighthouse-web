// Branch names carry a Jira key by convention (`feature/PROJ-12-add-login`).
// When the API could resolve that key, a branch reads as its ticket instead of
// its ref. These helpers keep that formatting identical everywhere it appears.

interface IssueBearing {
  issueKey?: string | null
  issueTitle?: string | null
  issueUrl?: string | null
}

/** `PROJ-12: Add login`, or just `PROJ-12` when only the key resolved. */
export function issueLabel(branch: IssueBearing | null | undefined): string | null {
  if (!branch?.issueKey) return null
  return branch.issueTitle ? `${branch.issueKey}: ${branch.issueTitle}` : branch.issueKey
}

/**
 * A deployment's stored branch has no URL of its own — the key was snapshotted,
 * the site lives on the org — so the link is rebuilt from whichever site URL the
 * caller has to hand.
 */
export function issueHref(
  siteUrl: string | null | undefined,
  issueKey: string | null | undefined,
): string | null {
  if (!siteUrl || !issueKey) return null
  return `${siteUrl.replace(/\/+$/, '')}/browse/${encodeURIComponent(issueKey)}`
}

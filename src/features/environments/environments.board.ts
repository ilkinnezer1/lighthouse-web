import { issueHref, issueLabel } from '@/features/deployments/issueLabel'
import type { EnvironmentListItem } from '@/types/api'

// What a board row says about an environment, in one place: the answer degrades
// from "the ticket on it" to "the branch it ran" to "the branch it is wired to",
// and an environment that has never deployed still has to say something.

type Branch = NonNullable<EnvironmentListItem['latestDeployment']>['branches'][number]

/**
 * The branch the environment is actually running. A MERGE branch rides on top
 * of the source for one build and is not what the sandbox represents.
 */
export function sourceBranch(env: EnvironmentListItem): Branch | null {
  return env.latestDeployment?.branches.find((b) => b.role === 'SOURCE') ?? null
}

/** `PROJ-12: Add login`, or null when the deployed branch names no ticket. */
export function environmentTicket(env: EnvironmentListItem): string | null {
  return issueLabel(sourceBranch(env))
}

/**
 * The branch to show: what the last deploy ran, falling back to the branch the
 * environment is configured to track (all it has before its first deploy).
 */
export function environmentBranch(env: EnvironmentListItem): string {
  return sourceBranch(env)?.name ?? env.branch ?? '—'
}

/** Link to the ticket, when both a key and the org's Jira site are known. */
export function environmentTicketHref(env: EnvironmentListItem): string | null {
  return issueHref(env.project.organization.atlassianSiteUrl, sourceBranch(env)?.issueKey)
}

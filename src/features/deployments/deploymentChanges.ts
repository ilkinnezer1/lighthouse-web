import type { DeploymentChanges } from '@/types/api'

// What the Changes section says about itself. The interesting part is that
// "nothing to show" has four different meanings, and only two of them are worth
// putting on screen.

/**
 * True when the section should not render at all: an unlinked repo or a build
 * with no commit has nothing to say, and explaining a non-problem is noise.
 */
export function changesHidden(data: DeploymentChanges | null): boolean {
  return data?.unavailable === 'unlinked' || data?.unavailable === 'no-commit'
}

/** The one-line summary above the commit list. */
export function changesHeadline(data: DeploymentChanges): string {
  if (data.unavailable === 'no-previous') return 'First deploy to this environment'
  if (data.unavailable === 'upstream') {
    return 'Could not reach GitHub to work out what changed'
  }
  if (data.totalCommits === 0) return 'No new commits since the last deploy here'
  const n = data.totalCommits
  return `${n} commit${n === 1 ? '' : 's'} since the last deploy here`
}

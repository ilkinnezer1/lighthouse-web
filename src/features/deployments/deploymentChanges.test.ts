import { describe, expect, it } from 'vitest'
import { changesHeadline, changesHidden } from './deploymentChanges'
import type { DeploymentChanges } from '@/types/api'

function changes(over: Partial<DeploymentChanges> = {}): DeploymentChanges {
  return {
    previous: { id: 'd0', commitSha: 'abc1234', createdAt: '2026-08-01T00:00:00.000Z' },
    commits: [],
    totalCommits: 0,
    truncated: false,
    unavailable: null,
    ...over,
  }
}

describe('changesHidden', () => {
  // Nothing to compare and nothing worth saying about it.
  it('hides the section for an unlinked repo or a build with no commit', () => {
    expect(changesHidden(changes({ unavailable: 'unlinked' }))).toBe(true)
    expect(changesHidden(changes({ unavailable: 'no-commit' }))).toBe(true)
  })

  // These two have something worth saying, so the section stays.
  it('keeps the section for a first deploy or an unreachable GitHub', () => {
    expect(changesHidden(changes({ unavailable: 'no-previous' }))).toBe(false)
    expect(changesHidden(changes({ unavailable: 'upstream' }))).toBe(false)
  })

  it('keeps the section for a normal range, and tolerates no data yet', () => {
    expect(changesHidden(changes({ totalCommits: 3 }))).toBe(false)
    expect(changesHidden(null)).toBe(false)
  })
})

describe('changesHeadline', () => {
  it('counts the commits, pluralizing correctly', () => {
    expect(changesHeadline(changes({ totalCommits: 5 }))).toBe(
      '5 commits since the last deploy here',
    )
    expect(changesHeadline(changes({ totalCommits: 1 }))).toBe(
      '1 commit since the last deploy here',
    )
  })

  // Redeploying the same commit is common; it is not an error, just nothing new.
  it('says so when the range is empty', () => {
    expect(changesHeadline(changes({ totalCommits: 0 }))).toBe(
      'No new commits since the last deploy here',
    )
  })

  it('distinguishes a first deploy from an empty range', () => {
    expect(changesHeadline(changes({ unavailable: 'no-previous', previous: null }))).toBe(
      'First deploy to this environment',
    )
  })

  // "Could not say" must never read as "nothing changed".
  it('says it could not tell when GitHub was unreachable', () => {
    expect(changesHeadline(changes({ unavailable: 'upstream' }))).toBe(
      'Could not reach GitHub to work out what changed',
    )
  })
})

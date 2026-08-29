import { describe, expect, it } from 'vitest'
import {
  currentBuild,
  findingFreshness,
  fixRange,
  fixRangeIsExact,
  fixRangeNote,
  isStale,
  needsStalenessNote,
  stalenessNote,
  type BuildRef,
} from './findings.staleness'
import type { DeploymentRef, Finding } from '@/types/api'

const FOUND_SHA = 'abc1234000000'
const NOW_SHA = 'def5678000000'

function build(over: Partial<DeploymentRef> = {}): DeploymentRef {
  return {
    id: 'dep-1',
    status: 'SUCCEEDED',
    commitSha: FOUND_SHA,
    commitMessage: 'Add the coupon rules',
    createdAt: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

function deployment(over: Partial<BuildRef> = {}): BuildRef {
  return { id: 'dep-2', status: 'SUCCEEDED', commitSha: NOW_SHA, ...over }
}

function finding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    title: 'Checkout total is wrong with a coupon',
    body: null,
    status: 'OPEN',
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z',
    reportedBy: null,
    resolvedBy: null,
    resolvedAt: null,
    foundOn: build(),
    fixedIn: null,
    logSnapshotStatus: 'CAPTURED',
    ...over,
  }
}

describe('currentBuild', () => {
  // What an environment serves is the last build that worked, not the last one
  // that was attempted — a failed deploy on top changes nothing.
  it('skips a newer build that failed', () => {
    const list = [
      deployment({ id: 'd3', status: 'FAILED' }),
      deployment({ id: 'd2', status: 'SUCCEEDED' }),
    ]
    expect(currentBuild(list)?.id).toBe('d2')
  })

  it('skips one still building', () => {
    const list = [deployment({ id: 'd3', status: 'BUILDING' }), deployment({ id: 'd2' })]
    expect(currentBuild(list)?.id).toBe('d2')
  })

  it('is null when nothing has ever succeeded', () => {
    expect(currentBuild([deployment({ status: 'FAILED' })])).toBeNull()
  })

  it('is null for an empty or absent list', () => {
    expect(currentBuild([])).toBeNull()
    expect(currentBuild(undefined)).toBeNull()
  })
})

describe('findingFreshness', () => {
  it('is current when the environment is still on the build it was found on', () => {
    const state = findingFreshness(build({ id: 'dep-1' }), deployment({ id: 'dep-1' }))
    expect(state.kind).toBe('current')
    expect(isStale(state)).toBe(false)
  })

  it('is superseded once the environment has moved to another commit', () => {
    expect(findingFreshness(build(), deployment())).toEqual({
      kind: 'superseded',
      foundSha: FOUND_SHA,
      currentSha: NOW_SHA,
    })
  })

  // Identity is the deployment, not the commit: a redeploy is a different
  // build, but claiming the environment "is now on abc1234" when the finding
  // was found on abc1234 would be a lie dressed as precision.
  it('distinguishes a redeploy of the same commit from a real move', () => {
    const state = findingFreshness(build(), deployment({ id: 'dep-9', commitSha: FOUND_SHA }))
    expect(state).toEqual({ kind: 'rebuilt', foundSha: FOUND_SHA })
    expect(isStale(state)).toBe(true)
  })

  it('reports nothing deployed when the environment has no live build', () => {
    expect(findingFreshness(build(), null)).toEqual({
      kind: 'nothing-deployed',
      foundSha: FOUND_SHA,
    })
  })

  it('still counts as superseded when the current build has no commit sha', () => {
    expect(findingFreshness(build(), deployment({ commitSha: null }))).toEqual({
      kind: 'superseded',
      foundSha: FOUND_SHA,
      currentSha: null,
    })
  })
})

describe('stalenessNote', () => {
  it('says nothing when the finding is on the build in front of you', () => {
    expect(stalenessNote({ kind: 'current' })).toBeNull()
  })

  it('names both builds when the environment has moved on', () => {
    expect(stalenessNote(findingFreshness(build(), deployment()))).toBe(
      'Found on abc1234 — this environment is now on def5678',
    )
  })

  it('says the commit is unchanged after a redeploy', () => {
    const state = findingFreshness(build(), deployment({ id: 'dep-9', commitSha: FOUND_SHA }))
    expect(stalenessNote(state)).toBe('Found on abc1234 — redeployed since at the same commit')
  })

  it('does not invent a sha it was not given', () => {
    expect(stalenessNote(findingFreshness(build(), deployment({ commitSha: null })))).toBe(
      'Found on abc1234 — this environment has deployed again since',
    )
    expect(stalenessNote(findingFreshness(build({ commitSha: null }), deployment()))).toBe(
      'Found on an earlier build — this environment is now on def5678',
    )
  })

  it('says so when nothing is deployed at all', () => {
    expect(stalenessNote(findingFreshness(build(), null))).toBe(
      'Found on abc1234 — nothing is deployed on this environment now',
    )
  })
})

describe('needsStalenessNote', () => {
  it('is worth saying while nothing has fixed it', () => {
    expect(needsStalenessNote(finding())).toBe(true)
    expect(needsStalenessNote(finding({ status: 'CANNOT_REPRODUCE' }))).toBe(true)
  })

  // The fix line already says found-on and fixed-in, and unlike the caveat it
  // stays true no matter what the environment is running.
  it('gives way to the fix record once there is one', () => {
    expect(needsStalenessNote(finding({ status: 'FIXED', fixedIn: build({ id: 'dep-2' }) }))).toBe(
      false,
    )
  })
})

describe('fixRange', () => {
  it('is nothing while the finding is unfixed', () => {
    expect(fixRange(finding())).toBeNull()
    expect(fixRangeNote(null)).toBeNull()
  })

  it('is a range from the build it was found on to the build that fixed it', () => {
    const f = finding({ status: 'FIXED', fixedIn: build({ id: 'dep-2', commitSha: NOW_SHA }) })
    expect(fixRange(f)).toEqual({ kind: 'range', fromSha: FOUND_SHA, toSha: NOW_SHA })
    expect(fixRangeNote(fixRange(f))).toBe('abc1234 → def5678')
  })

  // The server pins the fix to the environment's latest succeeded build, which
  // can be the build it was found on — a config or data fix, and truthful.
  it('handles being fixed on the very build it was found on', () => {
    const f = finding({ status: 'FIXED', fixedIn: build({ id: 'dep-1' }) })
    expect(fixRange(f)).toEqual({ kind: 'same-build', sha: FOUND_SHA })
    expect(fixRangeNote(fixRange(f))).toBe('Fixed on abc1234, the build it was found on')
  })
})

describe('fixRangeIsExact', () => {
  const fixed = finding({ status: 'FIXED', fixedIn: build({ id: 'dep-2', commitSha: NOW_SHA }) })

  it('accepts a changes range that starts at the build the finding was found on', () => {
    expect(fixRangeIsExact({ previous: { id: 'dep-1' } }, fixed)).toBe(true)
  })

  // Any wider range is other people's commits too; calling that "what fixed it"
  // would be a guess presented as a record.
  it('rejects a range that starts somewhere else', () => {
    expect(fixRangeIsExact({ previous: { id: 'dep-0' } }, fixed)).toBe(false)
  })

  it('rejects a missing or first-deploy range', () => {
    expect(fixRangeIsExact(null, fixed)).toBe(false)
    expect(fixRangeIsExact({ previous: null }, fixed)).toBe(false)
  })

  it('rejects an unfixed finding and a same-build fix', () => {
    expect(fixRangeIsExact({ previous: { id: 'dep-1' } }, finding())).toBe(false)
    expect(
      fixRangeIsExact({ previous: { id: 'dep-1' } }, finding({ fixedIn: build({ id: 'dep-1' }) })),
    ).toBe(false)
  })
})

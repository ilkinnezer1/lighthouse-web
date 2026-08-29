import { describe, expect, it } from 'vitest'
import {
  checkFreshness,
  isOutstanding,
  isStale,
  itemState,
  stalenessNote,
} from './checklist.staleness'
import type { ChecklistCheck, ChecklistItem, DeploymentRef } from '@/types/api'

const CHECKED_SHA = 'abc1234000000'
const NOW_SHA = 'def5678000000'

function build(over: Partial<DeploymentRef> = {}): DeploymentRef {
  return {
    id: 'dep-1',
    status: 'SUCCEEDED',
    commitSha: CHECKED_SHA,
    commitMessage: 'Add the coupon rules',
    createdAt: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

function check(over: Partial<ChecklistCheck> = {}): ChecklistCheck {
  return {
    id: 'chk-1',
    result: 'PASS',
    note: null,
    findingId: null,
    checkedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'a@example.com' },
    createdAt: '2026-08-20T11:00:00.000Z',
    build: build(),
    ...over,
  }
}

function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'it-1',
    title: 'Test PROJ-12',
    source: 'SEEDED',
    issueKey: 'PROJ-12',
    issueUrl: 'https://acme.atlassian.net/browse/PROJ-12',
    createdBy: null,
    createdAt: '2026-08-20T09:00:00.000Z',
    check: null,
    lastCheck: null,
    ...over,
  }
}

describe('itemState', () => {
  it('is unchecked when nobody has ever touched it', () => {
    expect(itemState(item())).toEqual({ kind: 'unchecked' })
  })

  it('reads the result of the check on this build', () => {
    expect(itemState(item({ check: check() })).kind).toBe('passed')
    expect(itemState(item({ check: check({ result: 'FAIL' }) })).kind).toBe('failed')
  })

  // The tick is a claim about a build. Once the build moves the claim does not
  // travel with it — it becomes a record of what someone tested, and the item
  // is outstanding again.
  it('is stale when the only check was made on an earlier build', () => {
    const state = itemState(item({ lastCheck: check() }))
    expect(state).toEqual({ kind: 'stale', check: check() })
  })

  it('is stale even when that earlier check was a pass', () => {
    expect(itemState(item({ lastCheck: check({ result: 'PASS' }) })).kind).toBe('stale')
  })

  // Defensive: the server never sends both, and if it ever did, the tick on the
  // build in front of you is the one that is about this build.
  it('prefers the check on this build if both somehow arrive', () => {
    const state = itemState(item({ check: check({ id: 'now' }), lastCheck: check({ id: 'old' }) }))
    expect(state).toEqual({ kind: 'passed', check: check({ id: 'now' }) })
  })
})

describe('isOutstanding', () => {
  // A FAIL is tested and broken — a developer's problem, not a tester's.
  it('counts anything without a check on this build, and nothing else', () => {
    expect(isOutstanding(item())).toBe(true)
    expect(isOutstanding(item({ lastCheck: check() }))).toBe(true)
    expect(isOutstanding(item({ check: check() }))).toBe(false)
    expect(isOutstanding(item({ check: check({ result: 'FAIL' }) }))).toBe(false)
  })
})

describe('checkFreshness', () => {
  it('is this-build when the tick was made against the build being viewed', () => {
    const state = checkFreshness(check(), build({ id: 'dep-1', commitSha: NOW_SHA }))
    expect(state).toEqual({ kind: 'this-build' })
    expect(isStale(state)).toBe(false)
  })

  it('is superseded once the build being viewed is a different commit', () => {
    expect(checkFreshness(check(), build({ id: 'dep-2', commitSha: NOW_SHA }))).toEqual({
      kind: 'superseded',
      checkedSha: CHECKED_SHA,
      currentSha: NOW_SHA,
    })
  })

  // Identity is the deployment, not the commit: a redeploy is a different
  // build, but saying "this build is abc1234" when the tick was made on
  // abc1234 would be a lie dressed as precision.
  it('distinguishes a redeploy of the same commit from a real move', () => {
    const state = checkFreshness(check(), build({ id: 'dep-9', commitSha: CHECKED_SHA }))
    expect(state).toEqual({ kind: 'rebuilt', checkedSha: CHECKED_SHA })
    expect(isStale(state)).toBe(true)
  })

  it('says nothing when there is no build to compare against', () => {
    expect(checkFreshness(check(), null)).toEqual({ kind: 'this-build' })
    expect(checkFreshness(check(), undefined)).toEqual({ kind: 'this-build' })
  })

  it('is still superseded when the build being viewed has no commit sha', () => {
    expect(checkFreshness(check(), build({ id: 'dep-2', commitSha: null }))).toEqual({
      kind: 'superseded',
      checkedSha: CHECKED_SHA,
      currentSha: null,
    })
  })
})

describe('stalenessNote', () => {
  it('says nothing when the tick is on the build in front of you', () => {
    expect(stalenessNote({ kind: 'this-build' })).toBeNull()
  })

  it('names both builds when the build has moved on', () => {
    expect(stalenessNote(checkFreshness(check(), build({ id: 'dep-2', commitSha: NOW_SHA })))).toBe(
      'Checked on abc1234 — this build is def5678',
    )
  })

  it('says the commit is unchanged after a redeploy', () => {
    const state = checkFreshness(check(), build({ id: 'dep-9', commitSha: CHECKED_SHA }))
    expect(stalenessNote(state)).toBe(
      'Checked on abc1234 — this build is a redeploy of the same commit',
    )
  })

  it('does not invent a sha it was not given', () => {
    expect(stalenessNote(checkFreshness(check(), build({ id: 'dep-2', commitSha: null })))).toBe(
      'Checked on abc1234 — this is a later build',
    )
    expect(
      stalenessNote(
        checkFreshness(check({ build: build({ commitSha: null }) }), build({ id: 'dep-2' })),
      ),
    ).toBe('Checked on an earlier build — this build is abc1234')
  })
})

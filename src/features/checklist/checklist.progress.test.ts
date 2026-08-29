import { describe, expect, it } from 'vitest'
import {
  boardLabel,
  boardTitle,
  checkedCount,
  checkedRatio,
  isComplete,
  isEmpty,
  progressLabel,
  summarize,
} from './checklist.progress'

describe('checkedCount', () => {
  it('is everything with a check on this build', () => {
    expect(checkedCount({ total: 7, remaining: 4 })).toBe(3)
    expect(checkedCount({ total: 7, remaining: 0 })).toBe(7)
    expect(checkedCount({ total: 0, remaining: 0 })).toBe(0)
  })

  // Never negative: the two numbers come from separate queries on the board,
  // and a "-1 of 3" is a worse answer than a slightly stale one.
  it('does not go negative if the two numbers disagree', () => {
    expect(checkedCount({ total: 2, remaining: 5 })).toBe(0)
  })
})

describe('isEmpty / isComplete', () => {
  it('separates an empty list from a finished one', () => {
    expect(isEmpty({ total: 0, remaining: 0 })).toBe(true)
    expect(isComplete({ total: 0, remaining: 0 })).toBe(false)
    expect(isComplete({ total: 3, remaining: 0 })).toBe(true)
    expect(isComplete({ total: 3, remaining: 1 })).toBe(false)
  })
})

describe('checkedRatio', () => {
  it('is the share of the list checked on this build', () => {
    expect(checkedRatio({ total: 4, remaining: 1 })).toBe(0.75)
    expect(checkedRatio({ total: 4, remaining: 4 })).toBe(0)
    expect(checkedRatio({ total: 4, remaining: 0 })).toBe(1)
  })

  it('is zero for an empty list rather than a divide by zero', () => {
    expect(checkedRatio({ total: 0, remaining: 0 })).toBe(0)
  })

  it('stays inside 0–1 whatever it is handed', () => {
    expect(checkedRatio({ total: 2, remaining: 9 })).toBe(0)
  })
})

describe('progressLabel', () => {
  it('counts up, because the number that grows is the one being worked on', () => {
    expect(progressLabel({ total: 7, remaining: 4 })).toBe('3 of 7 checked')
  })

  it('stops counting once there is nothing left', () => {
    expect(progressLabel({ total: 7, remaining: 0 })).toBe('All 7 checked')
  })

  // "All 1 checked" is not a sentence anyone writes.
  it('does not say "all" of a list of one', () => {
    expect(progressLabel({ total: 1, remaining: 0 })).toBe('Checked')
    expect(progressLabel({ total: 1, remaining: 1 })).toBe('0 of 1 checked')
  })

  it('says so when there is no list yet', () => {
    expect(progressLabel({ total: 0, remaining: 0 })).toBe('Nothing on the list yet')
  })
})

describe('boardLabel', () => {
  // The board has one narrow column, so it shows the number you would act on.
  it('shows what is left while anything is outstanding', () => {
    expect(boardLabel({ total: 9, remaining: 3 })).toBe('3 left')
  })

  it('shows the tally once the list is done', () => {
    expect(boardLabel({ total: 9, remaining: 0 })).toBe('9 checked')
  })

  it('is nothing at all for an environment with no checklist', () => {
    expect(boardLabel(null)).toBeNull()
    expect(boardLabel(undefined)).toBeNull()
    expect(boardLabel({ total: 0, remaining: 0 })).toBeNull()
  })
})

describe('boardTitle', () => {
  it('gets the plural right', () => {
    expect(boardTitle({ total: 9, remaining: 1 })).toBe(
      "1 checklist item not yet checked on this environment's current build",
    )
    expect(boardTitle({ total: 9, remaining: 2 })).toBe(
      "2 checklist items not yet checked on this environment's current build",
    )
  })

  it('is nothing when the column is', () => {
    expect(boardTitle(null)).toBeNull()
    expect(boardTitle({ total: 0, remaining: 0 })).toBeNull()
  })
})

describe('summarize', () => {
  const passed = { check: { result: 'PASS' as const } }
  const failed = { check: { result: 'FAIL' as const } }
  const unchecked = { check: null }

  it('splits the checks on this build by result', () => {
    expect(summarize([passed, passed, failed, unchecked])).toEqual({
      total: 4,
      passed: 2,
      failed: 1,
      remaining: 1,
    })
  })

  // The rule the whole feature rests on: remaining is "no check on THIS build",
  // not "not passed". Counting a fail as outstanding would send a tester back
  // to retest something already known to be broken.
  it('does not count a fail as outstanding', () => {
    expect(summarize([failed, failed])).toEqual({
      total: 2,
      passed: 0,
      failed: 2,
      remaining: 0,
    })
  })

  it('handles an empty list', () => {
    expect(summarize([])).toEqual({ total: 0, passed: 0, failed: 0, remaining: 0 })
  })
})

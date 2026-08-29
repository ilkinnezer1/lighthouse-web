import { describe, expect, it } from 'vitest'
import { checkedLine, itemDotClass, itemStateLabel, seedLabel } from './checklist.format'
import type { ChecklistCheck } from '@/types/api'

function check(over: Partial<Pick<ChecklistCheck, 'result' | 'checkedBy'>> = {}) {
  return {
    result: 'PASS' as const,
    checkedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'a@example.com' },
    ...over,
  }
}

describe('checkedLine', () => {
  // Named on every row: two people testing the same ticket without knowing it
  // is the waste this line exists to prevent.
  it('names the verb, the person and when', () => {
    expect(checkedLine(check(), '2h ago')).toBe('Passed by Aysel · 2h ago')
    expect(checkedLine(check({ result: 'FAIL' }), '2h ago')).toBe('Failed by Aysel · 2h ago')
  })

  it('drops the person when the account is gone', () => {
    expect(checkedLine(check({ checkedBy: null }), '2h ago')).toBe('Passed · 2h ago')
  })

  it('drops the timestamp rather than trailing a bare separator', () => {
    expect(checkedLine(check(), '')).toBe('Passed by Aysel')
    expect(checkedLine(check({ checkedBy: null }), '')).toBe('Passed')
  })
})

describe('itemStateLabel / itemDotClass', () => {
  // The two absences read as absences — grey, or an outline for the row nobody
  // has touched at all.
  it('gives colour only to the two states that are claims about this build', () => {
    expect(itemDotClass.passed).toContain('signal-live')
    expect(itemDotClass.failed).toContain('signal-error')
    expect(itemDotClass.stale).toContain('signal-idle')
    expect(itemDotClass.unchecked).toContain('border')
    expect(itemStateLabel.stale).toBe('Not on this build')
  })
})

describe('seedLabel', () => {
  it('promises the exact number of rows the click adds', () => {
    expect(seedLabel(6)).toBe('Add 6 from this build')
    expect(seedLabel(1)).toBe('Add 1 from this build')
  })
})

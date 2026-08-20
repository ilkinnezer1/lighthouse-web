import { describe, expect, it } from 'vitest'
import {
  filedLine,
  findingStatusLabel,
  isOpen,
  openCount,
  personName,
  resolutionLine,
} from './findings.format'
import type { Finding, UserRef } from '@/types/api'

function user(over: Partial<UserRef> = {}): UserRef {
  return { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'aysel@example.com', ...over }
}

function finding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    title: 'Checkout total is wrong with a coupon',
    body: null,
    status: 'OPEN',
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z',
    reportedBy: user(),
    resolvedBy: null,
    resolvedAt: null,
    foundOn: {
      id: 'dep-1',
      status: 'SUCCEEDED',
      commitSha: 'abc1234000',
      commitMessage: 'Add the coupon rules',
      createdAt: '2026-08-20T10:00:00.000Z',
    },
    fixedIn: null,
    logSnapshotStatus: 'CAPTURED',
    ...over,
  }
}

describe('status vocabulary', () => {
  it('spells the awkward one out', () => {
    expect(findingStatusLabel.CANNOT_REPRODUCE).toBe("Can't reproduce")
  })

  it('counts only what is still open', () => {
    const list = [
      finding(),
      finding({ id: 'f2', status: 'FIXED' }),
      finding({ id: 'f3', status: 'CANNOT_REPRODUCE' }),
      finding({ id: 'f4' }),
    ]
    expect(openCount(list)).toBe(2)
    expect(openCount([])).toBe(0)
    expect(openCount(undefined)).toBe(0)
    expect(isOpen(finding({ status: 'FIXED' }))).toBe(false)
  })
})

describe('personName', () => {
  it('falls back through displayName, username, then email', () => {
    expect(personName(user())).toBe('Aysel')
    expect(personName(user({ displayName: null }))).toBe('aysel')
    expect(personName(user({ displayName: '  ', username: '' }))).toBe('aysel@example.com')
  })

  it('does not pretend to know who a removed user was', () => {
    expect(personName(null)).toBe('Unknown')
  })
})

describe('filedLine', () => {
  it('is who filed it and when', () => {
    expect(filedLine(finding(), '2d ago')).toBe('Aysel · 2d ago')
  })

  it('drops the separator when there is no age to show', () => {
    expect(filedLine(finding(), '')).toBe('Aysel')
  })
})

describe('resolutionLine', () => {
  it('says nothing while the finding is open', () => {
    expect(resolutionLine(finding(), '3h ago')).toBeNull()
  })

  it('names who resolved it, and how', () => {
    const fixed = finding({ status: 'FIXED', resolvedBy: user({ displayName: 'Ada' }) })
    expect(resolutionLine(fixed, '3h ago')).toBe('Fixed by Ada · 3h ago')

    const dismissed = finding({ status: 'CANNOT_REPRODUCE', resolvedBy: user() })
    expect(resolutionLine(dismissed, '3h ago')).toBe("Closed as can't-reproduce by Aysel · 3h ago")
  })

  it('still reports the outcome when nobody is recorded against it', () => {
    expect(resolutionLine(finding({ status: 'FIXED' }), '3h ago')).toBe('Fixed · 3h ago')
  })
})

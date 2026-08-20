import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { clockTime, dayLabel, durationLabel, relativeTime, shortAgo } from './time'

const NOW = new Date('2026-08-11T14:30:00.000Z')

describe('durationLabel', () => {
  it('returns null while a deployment has no finish time', () => {
    expect(durationLabel('2026-08-11T14:00:00Z', null)).toBeNull()
    expect(durationLabel(null, '2026-08-11T14:00:00Z')).toBeNull()
    expect(durationLabel(null, null)).toBeNull()
  })

  it('returns null when the clock went backwards', () => {
    expect(durationLabel('2026-08-11T14:00:10Z', '2026-08-11T14:00:00Z')).toBeNull()
  })

  it('returns null for unparseable timestamps', () => {
    expect(durationLabel('not-a-date', '2026-08-11T14:00:00Z')).toBeNull()
  })

  it('renders whole seconds under a minute', () => {
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:00:00Z')).toBe('0s')
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:00:42Z')).toBe('42s')
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:00:59Z')).toBe('59s')
  })

  it('drops the seconds part when a duration lands on a whole minute', () => {
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:01:00Z')).toBe('1m')
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:05:00Z')).toBe('5m')
  })

  it('renders minutes and seconds below an hour', () => {
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:02:07Z')).toBe('2m 7s')
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T14:59:59Z')).toBe('59m 59s')
  })

  it('renders hours and minutes past an hour, dropping seconds', () => {
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T15:00:00Z')).toBe('1h 0m')
    expect(durationLabel('2026-08-11T14:00:00Z', '2026-08-11T16:23:45Z')).toBe('2h 23m')
  })

  it('rounds sub-second durations to zero seconds', () => {
    expect(durationLabel('2026-08-11T14:00:00.000Z', '2026-08-11T14:00:00.400Z')).toBe('0s')
  })
})

describe('relativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('describes the recent past in the largest fitting unit', () => {
    expect(relativeTime('2026-08-11T14:29:30Z')).toBe('30 seconds ago')
    expect(relativeTime('2026-08-11T14:25:00Z')).toBe('5 minutes ago')
    expect(relativeTime('2026-08-11T11:30:00Z')).toBe('3 hours ago')
    expect(relativeTime('2026-08-09T14:30:00Z')).toBe('2 days ago')
  })

  it('describes the future with a forward-looking phrase', () => {
    expect(relativeTime('2026-08-11T14:35:00Z')).toBe('in 5 minutes')
  })

  it('uses the "now" wording rather than "0 seconds ago"', () => {
    expect(relativeTime(NOW.toISOString())).toBe('now')
  })
})

describe('dayLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-08-11T12:00:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('labels the current calendar day "Today"', () => {
    expect(dayLabel('2026-08-11T00:05:00')).toBe('Today')
    expect(dayLabel('2026-08-11T23:55:00')).toBe('Today')
  })

  it('labels a future day "Today" as well, since it clamps at zero', () => {
    expect(dayLabel('2026-08-12T09:00:00')).toBe('Today')
  })

  it('labels the previous calendar day "Yesterday"', () => {
    expect(dayLabel('2026-08-10T23:00:00')).toBe('Yesterday')
  })

  it('counts days within the last week', () => {
    expect(dayLabel('2026-08-09T12:00:00')).toBe('2 days ago')
    expect(dayLabel('2026-08-05T12:00:00')).toBe('6 days ago')
  })

  it('falls back to an absolute date from a week out', () => {
    expect(dayLabel('2026-08-04T12:00:00')).toBe('Aug 4, 2026')
    expect(dayLabel('2025-12-25T12:00:00')).toBe('Dec 25, 2025')
  })
})

describe('clockTime', () => {
  it('renders a zero-padded 24-hour time', () => {
    expect(clockTime('2026-08-11T09:05:00')).toBe('09:05')
    expect(clockTime('2026-08-11T13:07:00')).toBe('13:07')
    expect(clockTime('2026-08-11T23:59:00')).toBe('23:59')
  })

  // `hour12: false` selects the h24 hour cycle, so midnight reads 24:00 rather
  // than 00:00. Pinned as-is; switching to `hourCycle: 'h23'` is a UI change.
  it('renders midnight as 24:00', () => {
    expect(clockTime('2026-08-11T00:00:00')).toBe('24:00')
    expect(clockTime('2026-08-11T00:30:00')).toBe('24:30')
  })
})

describe('shortAgo', () => {
  const now = Date.parse('2026-08-11T14:30:00.000Z')
  const at = (iso: string) => shortAgo(iso, now)

  it('says "just now" rather than counting the first seconds', () => {
    expect(at('2026-08-11T14:30:00Z')).toBe('just now')
    expect(at('2026-08-11T14:29:16Z')).toBe('just now')
  })

  it('counts whole minutes below an hour', () => {
    expect(at('2026-08-11T14:29:14Z')).toBe('1m ago')
    expect(at('2026-08-11T14:28:00Z')).toBe('2m ago')
    expect(at('2026-08-11T13:31:00Z')).toBe('59m ago')
  })

  it('counts whole hours below a day', () => {
    expect(at('2026-08-11T13:30:00Z')).toBe('1h ago')
    expect(at('2026-08-10T14:31:00Z')).toBe('23h ago')
  })

  it('counts whole days below a week', () => {
    expect(at('2026-08-10T14:30:00Z')).toBe('1d ago')
    expect(at('2026-08-05T14:30:00Z')).toBe('6d ago')
  })

  it('switches to an absolute date past a week, adding the year only when it differs', () => {
    expect(at('2026-08-04T14:30:00Z')).toBe('Aug 4')
    expect(at('2025-12-25T14:30:00Z')).toBe('Dec 25, 2025')
  })

  // Clock skew between the API and the browser must not print "in 3 minutes".
  it('clamps a future timestamp to "just now"', () => {
    expect(at('2026-08-11T14:35:00Z')).toBe('just now')
  })

  it('renders nothing for an unparseable timestamp', () => {
    expect(at('not-a-date')).toBe('')
  })
})

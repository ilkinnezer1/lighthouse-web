import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  IDLE_TIMEOUT_PRESETS,
  SLEEPING_URL_NOTE,
  hibernationDetail,
  hibernationDuration,
  hibernationErrorMessage,
  hibernationFailure,
  hibernationStatus,
  hibernationStatusLabel,
  isSleeping,
  isValidIdleTimeout,
  sleepBadgeCompactLabel,
  sleepBadgeLabel,
  sleepBadgeTitle,
  timeoutLabel,
  timeoutOptions,
  timeoutShort,
} from './environments.hibernation'
import type { EnvironmentHibernation, EnvironmentLock } from '@/types/api'

const NOW = Date.parse('2026-08-20T12:00:00.000Z')

function hibernation(over: Partial<EnvironmentHibernation> = {}): EnvironmentHibernation {
  return {
    enabled: false,
    idleTimeoutMinutes: 240,
    sleeping: false,
    hibernatedAt: null,
    lastActivityAt: null,
    ...over,
  }
}

function lock(): EnvironmentLock {
  return {
    lockedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'aysel@example.com' },
    lockedAt: '2026-08-20T11:26:00.000Z',
    expiresAt: '2026-08-20T12:34:00.000Z',
    reason: null,
  }
}

function failure(data: unknown, status: number): AxiosError {
  const err = new AxiosError('Request failed')
  err.response = {
    status,
    statusText: 'Error',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return err
}

const minutes = (n: number) => n * 60_000

describe('hibernationDuration', () => {
  it('reads in minutes under an hour', () => {
    expect(hibernationDuration(minutes(20))).toBe('20m')
    expect(hibernationDuration(minutes(59))).toBe('59m')
  })

  it('reads in hours and minutes under a day', () => {
    expect(hibernationDuration(minutes(60))).toBe('1h')
    expect(hibernationDuration(minutes(200))).toBe('3h 20m')
    expect(hibernationDuration(minutes(240))).toBe('4h')
  })

  // A sleeping environment is a thing nobody has looked at for a while, so days
  // are the common case rather than the exotic one.
  it('reads in days past twenty-four hours', () => {
    expect(hibernationDuration(minutes(1440))).toBe('1d')
    expect(hibernationDuration(minutes(1440 + 180))).toBe('1d 3h')
    expect(hibernationDuration(minutes(10_080))).toBe('7d')
  })

  // "0m" reads as "not yet", which is the opposite of what just happened.
  it('collapses the first minute and never goes negative', () => {
    expect(hibernationDuration(30_000)).toBe('<1m')
    expect(hibernationDuration(0)).toBe('<1m')
    expect(hibernationDuration(-5000)).toBe('<1m')
  })
})

describe('timeoutLabel', () => {
  it('spells out whole days and hours', () => {
    expect(timeoutLabel(10_080)).toBe('7 days')
    expect(timeoutLabel(1440)).toBe('1 day')
    expect(timeoutLabel(240)).toBe('4 hours')
    expect(timeoutLabel(60)).toBe('1 hour')
  })

  it('falls back to minutes for anything that is not a whole unit', () => {
    expect(timeoutLabel(90)).toBe('90 minutes')
    expect(timeoutLabel(15)).toBe('15 minutes')
    expect(timeoutLabel(1)).toBe('1 minute')
  })
})

describe('timeoutShort', () => {
  it('compacts a timeout for mid-sentence use', () => {
    expect(timeoutShort(240)).toBe('4h')
    expect(timeoutShort(10_080)).toBe('7d')
    expect(timeoutShort(90)).toBe('1h 30m')
  })
})

describe('isValidIdleTimeout', () => {
  it('accepts the whole range the server accepts', () => {
    expect(isValidIdleTimeout(1)).toBe(true)
    expect(isValidIdleTimeout(240)).toBe(true)
    expect(isValidIdleTimeout(10_080)).toBe(true)
  })

  it('rejects anything outside it, and anything fractional', () => {
    expect(isValidIdleTimeout(0)).toBe(false)
    expect(isValidIdleTimeout(-5)).toBe(false)
    expect(isValidIdleTimeout(10_081)).toBe(false)
    expect(isValidIdleTimeout(2.5)).toBe(false)
    expect(isValidIdleTimeout(Number.NaN)).toBe(false)
  })
})

describe('timeoutOptions', () => {
  it('offers the presets when the stored value is one of them', () => {
    expect(timeoutOptions(240)).toEqual(IDLE_TIMEOUT_PRESETS)
  })

  // Set to a minute over the API to watch it sleep, the dialog must still show
  // what it is set to rather than silently offering to change it.
  it('folds an off-preset value into the list, in order', () => {
    expect(timeoutOptions(1)).toEqual([1, ...IDLE_TIMEOUT_PRESETS])
    expect(timeoutOptions(90)).toContain(90)
    expect(timeoutOptions(90)).toEqual([...timeoutOptions(90)].sort((a, b) => a - b))
  })

  it('ignores a stored value the server would not accept', () => {
    expect(timeoutOptions(0)).toEqual(IDLE_TIMEOUT_PRESETS)
    expect(timeoutOptions(99_999)).toEqual(IDLE_TIMEOUT_PRESETS)
  })
})

describe('hibernationStatus', () => {
  it('is asleep with the time it has been asleep for', () => {
    const s = hibernationStatus(
      hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
      NOW,
    )
    expect(s).toEqual({ kind: 'asleep', asleepMs: minutes(180) })
  })

  // Manually slept, then opted out: still asleep, and saying "off" would hide a
  // stopped environment behind a settings label.
  it('reports sleeping before enabled', () => {
    const s = hibernationStatus(
      hibernation({ enabled: false, sleeping: true, hibernatedAt: '2026-08-20T11:00:00.000Z' }),
      NOW,
    )
    expect(s.kind).toBe('asleep')
  })

  it('is armed with the idle clock and what is left of the timeout', () => {
    const s = hibernationStatus(
      hibernation({
        enabled: true,
        idleTimeoutMinutes: 240,
        lastActivityAt: '2026-08-20T11:40:00.000Z',
      }),
      NOW,
    )
    expect(s).toEqual({
      kind: 'armed',
      idleMs: minutes(20),
      timeoutMs: minutes(240),
      remainingMs: minutes(220),
    })
  })

  // Never negative: a countdown past zero renders as nonsense, and the sweep
  // runs on its own interval so overshoot is normal.
  it('floors the remaining time at zero once the timeout has elapsed', () => {
    const s = hibernationStatus(
      hibernation({
        enabled: true,
        idleTimeoutMinutes: 60,
        lastActivityAt: '2026-08-20T09:00:00.000Z',
      }),
      NOW,
    )
    expect(s.kind === 'armed' && s.remainingMs).toBe(0)
  })

  // No reading is not a reading of zero — the same distinction the server's
  // parser makes. An unknown idle clock must not render as "sleeps now".
  it('leaves the idle clock null when there is no activity stamp', () => {
    const s = hibernationStatus(hibernation({ enabled: true, lastActivityAt: null }), NOW)
    expect(s).toEqual({ kind: 'armed', idleMs: null, timeoutMs: minutes(240), remainingMs: null })
  })

  it('treats an unparseable stamp as no reading', () => {
    const s = hibernationStatus(hibernation({ enabled: true, lastActivityAt: 'not-a-date' }), NOW)
    expect(s.kind === 'armed' && s.idleMs).toBeNull()
  })

  // A clock skewed forward would otherwise produce a negative idle time.
  it('never reports negative elapsed time', () => {
    const s = hibernationStatus(
      hibernation({ enabled: true, lastActivityAt: '2026-08-20T13:00:00.000Z' }),
      NOW,
    )
    expect(s.kind === 'armed' && s.idleMs).toBe(0)
  })

  it('is off when disabled and awake', () => {
    expect(hibernationStatus(hibernation(), NOW)).toEqual({ kind: 'off' })
  })

  // The field is always sent, but a component can be handed a row from before
  // this shipped, and it must not throw.
  it('is off when the field is absent entirely', () => {
    expect(hibernationStatus(null, NOW)).toEqual({ kind: 'off' })
    expect(hibernationStatus(undefined, NOW)).toEqual({ kind: 'off' })
  })
})

describe('isSleeping', () => {
  it('is the sleeping flag, tolerating a missing field', () => {
    expect(isSleeping(hibernation({ sleeping: true }))).toBe(true)
    expect(isSleeping(hibernation())).toBe(false)
    expect(isSleeping(null)).toBe(false)
    expect(isSleeping(undefined)).toBe(false)
  })
})

describe('hibernationStatusLabel', () => {
  it('names how long it has been asleep', () => {
    expect(hibernationStatusLabel({ kind: 'asleep', asleepMs: minutes(180) })).toBe('Asleep · 3h')
  })

  it('counts down to the sleep while it is armed', () => {
    expect(
      hibernationStatusLabel({
        kind: 'armed',
        idleMs: minutes(20),
        timeoutMs: minutes(240),
        remainingMs: minutes(220),
      }),
    ).toBe('Sleeps in 3h 40m')
  })

  // "Sleeps in <1m" would keep promising a countdown that already ran out; the
  // sweep is on its own interval, so say that instead.
  it('stops counting down once the timeout is spent', () => {
    expect(
      hibernationStatusLabel({
        kind: 'armed',
        idleMs: minutes(300),
        timeoutMs: minutes(240),
        remainingMs: 0,
      }),
    ).toBe('Sleeps on the next check')
  })

  it('states the timeout rather than a countdown when the idle clock is unknown', () => {
    expect(
      hibernationStatusLabel({
        kind: 'armed',
        idleMs: null,
        timeoutMs: minutes(240),
        remainingMs: null,
      }),
    ).toBe('Sleeps after 4h')
  })

  it('says so plainly when hibernation is off', () => {
    expect(hibernationStatusLabel({ kind: 'off' })).toBe('Hibernation off')
  })
})

describe('hibernationDetail', () => {
  // The one sentence the whole feature turns on.
  it('says the URL needs a wake while it is asleep', () => {
    expect(hibernationDetail({ kind: 'asleep', asleepMs: minutes(10) })).toBe(SLEEPING_URL_NOTE)
    expect(SLEEPING_URL_NOTE).toBe('Sleeping — wake it to use the URL')
  })

  it('reads the idle clock against the timeout', () => {
    expect(
      hibernationDetail({
        kind: 'armed',
        idleMs: minutes(20),
        timeoutMs: minutes(240),
        remainingMs: minutes(220),
      }),
    ).toBe('Idle for 20m of a 4h timeout')
  })

  it('describes the rule instead when nothing has been measured yet', () => {
    expect(
      hibernationDetail({ kind: 'armed', idleMs: null, timeoutMs: minutes(240), remainingMs: null }),
    ).toBe('Sleeps once nothing has hit its URL for 4h')
  })

  it('says what off means', () => {
    expect(hibernationDetail({ kind: 'off' })).toBe(
      'Stays up whether or not anything is using it',
    )
  })
})

describe('sleepBadgeLabel', () => {
  it('names the state and how long it has held', () => {
    expect(
      sleepBadgeLabel(
        hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
        NOW,
      ),
    ).toBe('Asleep · 3h')
  })

  // Same rule as the lock badge: nothing to say means nothing rendered.
  it('is empty for an awake environment, whatever its settings', () => {
    expect(sleepBadgeLabel(hibernation({ enabled: true }), NOW)).toBe('')
    expect(sleepBadgeLabel(hibernation(), NOW)).toBe('')
    expect(sleepBadgeLabel(null, NOW)).toBe('')
  })

  it('still names the state when the timestamp is missing', () => {
    expect(sleepBadgeLabel(hibernation({ sleeping: true, hibernatedAt: null }), NOW)).toBe(
      'Asleep · <1m',
    )
  })
})

describe('sleepBadgeCompactLabel', () => {
  // The board's columns are already spoken for, and a wider one crushes the
  // branch beside it — so the row keeps the number and the word goes to the
  // tooltip.
  it('drops the word and keeps the duration', () => {
    expect(
      sleepBadgeCompactLabel(
        hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
        NOW,
      ),
    ).toBe('3h')
  })

  it('is empty for an awake environment', () => {
    expect(sleepBadgeCompactLabel(hibernation({ enabled: true }), NOW)).toBe('')
    expect(sleepBadgeCompactLabel(null, NOW)).toBe('')
  })
})

describe('sleepBadgeTitle', () => {
  it('explains the 404 rather than leaving it to be discovered', () => {
    const title = sleepBadgeTitle(
      hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
      NOW,
    )
    expect(title).toContain('Asleep for 3h')
    expect(title).toContain('404')
  })

  it('is empty when the environment is awake', () => {
    expect(sleepBadgeTitle(hibernation({ enabled: true }), NOW)).toBe('')
  })
})

describe('hibernationFailure', () => {
  // Hibernation returns the identical body a refused deploy does, so it goes
  // through the same parser rather than a second one.
  it('recognises the lock conflict the lock feature already produces', () => {
    const err = failure({ statusCode: 409, code: 'ENVIRONMENT_LOCKED', lock: lock() }, 409)
    const f = hibernationFailure(err, 'fallback')
    expect(f.kind).toBe('locked')
    expect(f.kind === 'locked' && f.lock.lockedBy.id).toBe('u1')
    expect(hibernationErrorMessage(err, 'fallback')).toContain('Aysel')
  })

  // The three bare 409s are the whole reason this exists: they arrive with no
  // code of their own and must not collapse into one message.
  it('tells the three plain conflicts apart', () => {
    expect(
      hibernationFailure(
        failure({ message: 'Environment has no successful deployment to wake' }, 409),
        'f',
      ).kind,
    ).toBe('no-deployment')
    expect(
      hibernationFailure(
        failure({ message: 'A deployment is in progress for this environment' }, 409),
        'f',
      ).kind,
    ).toBe('deploy-in-flight')
    expect(
      hibernationFailure(failure({ message: 'Environment has no running containers' }, 409), 'f')
        .kind,
    ).toBe('no-containers')
  })

  it('gives each of them its own sentence', () => {
    const said = [
      'Environment has no successful deployment to wake',
      'A deployment is in progress for this environment',
      'Environment has no running containers',
    ].map((message) => hibernationErrorMessage(failure({ message }, 409), 'f'))
    expect(new Set(said).size).toBe(3)
    expect(said[0]).toMatch(/never deployed successfully/)
    expect(said[1]).toMatch(/deploy is in flight/)
    expect(said[2]).toMatch(/no running containers/)
  })

  it('reads the worker 404 as nothing to act on', () => {
    expect(
      hibernationFailure(failure({ message: 'Deployment has no containers' }, 404), 'f').kind,
    ).toBe('no-containers')
  })

  it('names the worker when the proxy cannot reach it', () => {
    expect(hibernationFailure(failure({ message: 'Worker unreachable' }, 502), 'f').kind).toBe(
      'worker-unreachable',
    )
    expect(hibernationErrorMessage(failure({ message: 'Worker unreachable' }, 502), 'f')).toMatch(
      /worker is unreachable/,
    )
  })

  // Anything unrecognised keeps the server's own wording rather than being
  // flattened into a generic failure.
  it('passes an unfamiliar failure through with its message intact', () => {
    const f = hibernationFailure(failure({ message: 'Environment not found' }, 404), 'fallback')
    expect(f).toEqual({ kind: 'other', message: 'Environment not found' })
  })

  it('falls back for a non-axios failure', () => {
    expect(hibernationFailure(new Error('boom'), 'Could not wake')).toEqual({
      kind: 'other',
      message: 'Could not wake',
    })
  })

  // A 409 carrying the lock code but no lock is not something we can name.
  it('does not claim a lock it was not given', () => {
    expect(hibernationFailure(failure({ code: 'ENVIRONMENT_LOCKED' }, 409), 'f').kind).toBe('other')
  })
})

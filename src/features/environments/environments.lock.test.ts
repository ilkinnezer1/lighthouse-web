import { AxiosError, AxiosHeaders } from 'axios'
import { describe, expect, it } from 'vitest'
import {
  isLockLive,
  lockBadgeLabel,
  lockConflict,
  lockHolderName,
  lockRemainingLabel,
  lockRemainingMs,
  lockState,
} from './environments.lock'
import type { EnvironmentLock, EnvironmentLockHolder } from '@/types/api'

const NOW = Date.parse('2026-08-20T12:00:00.000Z')

function holder(over: Partial<EnvironmentLockHolder> = {}): EnvironmentLockHolder {
  return {
    id: 'u1',
    username: 'aysel',
    displayName: 'Aysel',
    email: 'aysel@example.com',
    ...over,
  }
}

function lock(over: Partial<EnvironmentLock> = {}): EnvironmentLock {
  return {
    lockedBy: holder(),
    lockedAt: '2026-08-20T11:26:00.000Z',
    expiresAt: '2026-08-20T12:34:00.000Z',
    reason: 'Regression pass on checkout',
    ...over,
  }
}

function conflict(data: unknown, status = 409): AxiosError {
  const err = new AxiosError('Conflict')
  err.response = {
    status,
    statusText: 'Conflict',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return err
}

describe('isLockLive', () => {
  it('is live while the expiry is still ahead', () => {
    expect(isLockLive(lock(), NOW)).toBe(true)
  })

  // The server expires lazily, so a still-present lock object is not a live lock.
  it('is not live once the expiry has passed', () => {
    expect(isLockLive(lock({ expiresAt: '2026-08-20T11:59:59.000Z' }), NOW)).toBe(false)
  })

  it('treats the exact expiry instant as over', () => {
    expect(isLockLive(lock({ expiresAt: '2026-08-20T12:00:00.000Z' }), NOW)).toBe(false)
  })

  it('is not live for no lock at all, or an unparseable expiry', () => {
    expect(isLockLive(null, NOW)).toBe(false)
    expect(isLockLive(undefined, NOW)).toBe(false)
    expect(isLockLive(lock({ expiresAt: 'not-a-date' }), NOW)).toBe(false)
  })
})

describe('lockRemainingMs', () => {
  it('counts down to the expiry', () => {
    expect(lockRemainingMs(lock(), NOW)).toBe(34 * 60000)
  })

  // Never negative: a countdown that goes past zero renders as nonsense.
  it('floors at zero for an elapsed lock', () => {
    expect(lockRemainingMs(lock({ expiresAt: '2026-08-20T10:00:00.000Z' }), NOW)).toBe(0)
    expect(lockRemainingMs(lock({ expiresAt: 'not-a-date' }), NOW)).toBe(0)
  })
})

describe('lockHolderName', () => {
  it('prefers the display name', () => {
    expect(lockHolderName(holder())).toBe('Aysel')
  })

  it('falls back to username, then email', () => {
    expect(lockHolderName(holder({ displayName: null }))).toBe('aysel')
    expect(lockHolderName(holder({ displayName: null, username: '' }))).toBe('aysel@example.com')
  })

  // A display name of only whitespace is not a name.
  it('ignores a blank display name', () => {
    expect(lockHolderName(holder({ displayName: '   ' }))).toBe('aysel')
  })
})

describe('lockRemainingLabel', () => {
  it('reads in minutes under an hour', () => {
    expect(lockRemainingLabel(34 * 60000)).toBe('34m')
    expect(lockRemainingLabel(59 * 60000)).toBe('59m')
  })

  it('reads in hours and minutes above one', () => {
    expect(lockRemainingLabel(60 * 60000)).toBe('1h')
    expect(lockRemainingLabel(130 * 60000)).toBe('2h 10m')
    expect(lockRemainingLabel(4 * 60 * 60000)).toBe('4h')
  })

  // "0m left" reads as expired when it is not; the last minute says so.
  it('collapses the final minute', () => {
    expect(lockRemainingLabel(30_000)).toBe('<1m')
    expect(lockRemainingLabel(0)).toBe('<1m')
  })
})

describe('lockState', () => {
  it('is mine when the holder is the current user', () => {
    const s = lockState(lock(), 'u1', NOW)
    expect(s.kind).toBe('mine')
    expect(s.kind !== 'unlocked' && s.remainingMs).toBe(34 * 60000)
  })

  it('is held when someone else has it', () => {
    expect(lockState(lock(), 'u2', NOW).kind).toBe('held')
  })

  // Signed out, someone else's lock is still someone else's.
  it('is held when there is no current user', () => {
    expect(lockState(lock(), null, NOW).kind).toBe('held')
    expect(lockState(lock(), undefined, NOW).kind).toBe('held')
  })

  it('is unlocked with no lock', () => {
    expect(lockState(null, 'u1', NOW).kind).toBe('unlocked')
  })

  // The whole point of the module: expiry beats ownership and beats presence.
  it('is unlocked once the lock has expired, even for its own holder', () => {
    const expired = lock({ expiresAt: '2026-08-20T11:00:00.000Z' })
    expect(lockState(expired, 'u1', NOW).kind).toBe('unlocked')
    expect(lockState(expired, 'u2', NOW).kind).toBe('unlocked')
  })
})

describe('lockBadgeLabel', () => {
  it('names the holder and the time left', () => {
    expect(lockBadgeLabel(lock(), NOW)).toBe('Aysel · 34m left')
  })

  it('uses the fallback name when there is no display name', () => {
    expect(lockBadgeLabel(lock({ lockedBy: holder({ displayName: null }) }), NOW)).toBe(
      'aysel · 34m left',
    )
  })
})

describe('lockConflict', () => {
  it('extracts the lock from a refused deploy', () => {
    const err = conflict({ statusCode: 409, code: 'ENVIRONMENT_LOCKED', lock: lock() })
    expect(lockConflict(err)?.lockedBy.id).toBe('u1')
  })

  // Branching on the code, not the body shape: another 409 must not render as a lock.
  it('ignores a 409 that is not a lock conflict', () => {
    expect(lockConflict(conflict({ statusCode: 409, message: 'Name already taken' }))).toBeNull()
    expect(
      lockConflict(conflict({ statusCode: 409, code: 'SOMETHING_ELSE', lock: lock() })),
    ).toBeNull()
  })

  it('ignores other statuses and non-axios failures', () => {
    expect(lockConflict(conflict({ code: 'ENVIRONMENT_LOCKED', lock: lock() }, 500))).toBeNull()
    expect(lockConflict(new Error('offline'))).toBeNull()
    expect(lockConflict(null)).toBeNull()
  })

  // A lock-coded 409 with no payload is still not something we can render.
  it('returns null when the code is right but the lock is missing', () => {
    expect(lockConflict(conflict({ code: 'ENVIRONMENT_LOCKED' }))).toBeNull()
  })
})

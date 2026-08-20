import { isAxiosError } from 'axios'
import type { EnvironmentLock, EnvironmentLockHolder } from '@/types/api'

// A lock is a claim with an expiry, and the server expires it lazily. So a lock
// object in hand is not evidence of a live lock: every question here is answered
// against `expiresAt` and the clock, never against presence. A board left open
// past an expiry must go quiet on its own, without a refetch.

export type LockState =
  | { kind: 'unlocked' }
  | { kind: 'mine'; lock: EnvironmentLock; remainingMs: number }
  | { kind: 'held'; lock: EnvironmentLock; remainingMs: number }

export function lockRemainingMs(lock: EnvironmentLock, now: number): number {
  const ms = Date.parse(lock.expiresAt) - now
  return Number.isFinite(ms) ? Math.max(0, ms) : 0
}

/** An unparseable or elapsed `expiresAt` is not a lock. */
export function isLockLive(lock: EnvironmentLock | null | undefined, now: number): boolean {
  if (!lock) return false
  const at = Date.parse(lock.expiresAt)
  return Number.isFinite(at) && at > now
}

/** displayName → username → email, so a holder always has something to show. */
export function lockHolderName(holder: EnvironmentLockHolder): string {
  return holder.displayName?.trim() || holder.username?.trim() || holder.email
}

/**
 * Compact countdown for a badge: `34m`, `2h 10m`, `<1m`. Deliberately not
 * `relativeTime` — "in 34 minutes" is too wide for a row and reads as a
 * timestamp rather than a budget running down.
 */
export function lockRemainingLabel(remainingMs: number): string {
  const mins = Math.floor(remainingMs / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem ? `${hrs}h ${rem}m` : `${hrs}h`
}

/** The one call a view makes: which of the three things is true right now. */
export function lockState(
  lock: EnvironmentLock | null | undefined,
  currentUserId: string | null | undefined,
  now: number,
): LockState {
  if (!lock || !isLockLive(lock, now)) return { kind: 'unlocked' }
  const remainingMs = lockRemainingMs(lock, now)
  const mine = !!currentUserId && lock.lockedBy.id === currentUserId
  return { kind: mine ? 'mine' : 'held', lock, remainingMs }
}

/** `Aysel · 34m left`, the whole badge in one string. */
export function lockBadgeLabel(lock: EnvironmentLock, now: number): string {
  return `${lockHolderName(lock.lockedBy)} · ${lockRemainingLabel(lockRemainingMs(lock, now))} left`
}

/**
 * The lock behind a refused deploy, or null for any other failure. Keyed on the
 * server's `code` rather than the shape of the body, so an unrelated 409 never
 * renders as a lock conflict.
 */
export function lockConflict(error: unknown): EnvironmentLock | null {
  if (!isAxiosError(error) || error.response?.status !== 409) return null
  const data = error.response.data as { code?: string; lock?: EnvironmentLock } | undefined
  return data?.code === 'ENVIRONMENT_LOCKED' && data.lock ? data.lock : null
}

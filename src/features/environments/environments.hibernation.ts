import { isAxiosError } from 'axios'
import { lockConflict, lockHolderName } from './environments.lock'
import { apiErrorMessage } from '@/lib/api'
import type { EnvironmentHibernation, EnvironmentLock } from '@/types/api'

// Hibernation stops the containers, and Traefik's docker provider drops the
// router with them — so a sleeping environment's URL returns 404, not a 502 or
// a hang. A bare 404 is indistinguishable from "no such environment", which is
// why every surface that shows the URL has to say this out loud. That sentence
// lives here, once, rather than being retyped into each template.
export const SLEEPING_URL_NOTE = 'Sleeping — wake it to use the URL'

export const MIN_IDLE_TIMEOUT_MINUTES = 1
export const MAX_IDLE_TIMEOUT_MINUTES = 10_080

export const IDLE_TIMEOUT_PRESETS = [15, 30, 60, 120, 240, 480, 1440, 10_080]

const MINUTE_MS = 60_000

function elapsedMs(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null
  const at = Date.parse(iso)
  if (!Number.isFinite(at)) return null
  return Math.max(0, now - at)
}

/**
 * Compact span for a badge or a dense row: `<1m`, `20m`, `3h`, `3h 20m`, `2d`.
 * Deliberately not `relativeTime` — "3 hours ago" is a timestamp, and this is
 * a duration something has been true for.
 */
export function hibernationDuration(ms: number): string {
  const mins = Math.floor(Math.max(0, ms) / MINUTE_MS)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  const remMins = mins % 60
  if (hrs < 24) return remMins ? `${hrs}h ${remMins}m` : `${hrs}h`
  const days = Math.floor(hrs / 24)
  const remHrs = hrs % 24
  return remHrs ? `${days}d ${remHrs}h` : `${days}d`
}

/** Spelled out, for a form control: `4 hours`, `7 days`, `90 minutes`. */
export function timeoutLabel(minutes: number): string {
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? '' : 's'}`
  if (minutes >= 1440 && minutes % 1440 === 0) return plural(minutes / 1440, 'day')
  if (minutes >= 60 && minutes % 60 === 0) return plural(minutes / 60, 'hour')
  return plural(minutes, 'minute')
}

/** The same span compacted, for mid-sentence use: `of a 4h timeout`. */
export function timeoutShort(minutes: number): string {
  return hibernationDuration(minutes * MINUTE_MS)
}

export function isValidIdleTimeout(minutes: number): boolean {
  return (
    Number.isInteger(minutes) &&
    minutes >= MIN_IDLE_TIMEOUT_MINUTES &&
    minutes <= MAX_IDLE_TIMEOUT_MINUTES
  )
}

/**
 * Presets plus whatever this environment is actually set to. A value chosen
 * outside the UI (or a default this build does not list) must still be
 * selectable, or opening the dialog would silently offer to change it.
 */
export function timeoutOptions(current: number): number[] {
  const merged = new Set(IDLE_TIMEOUT_PRESETS)
  if (isValidIdleTimeout(current)) merged.add(current)
  return [...merged].sort((a, b) => a - b)
}

export type HibernationStatus =
  | { kind: 'asleep'; asleepMs: number }
  | { kind: 'armed'; idleMs: number | null; timeoutMs: number; remainingMs: number | null }
  | { kind: 'off' }

/**
 * `sleeping` is read before `enabled`, not after: sleeping now with the toggle
 * since switched off is a real state, and reporting it as "off" would hide a
 * stopped environment behind a settings label.
 */
export function hibernationStatus(
  h: EnvironmentHibernation | null | undefined,
  now: number,
): HibernationStatus {
  if (!h) return { kind: 'off' }
  if (h.sleeping) return { kind: 'asleep', asleepMs: elapsedMs(h.hibernatedAt, now) ?? 0 }
  if (!h.enabled) return { kind: 'off' }
  const timeoutMs = h.idleTimeoutMinutes * MINUTE_MS
  const idleMs = elapsedMs(h.lastActivityAt, now)
  return {
    kind: 'armed',
    idleMs,
    timeoutMs,
    remainingMs: idleMs === null ? null : Math.max(0, timeoutMs - idleMs),
  }
}

export function isSleeping(h: EnvironmentHibernation | null | undefined): boolean {
  return !!h?.sleeping
}

/** The headline: `Asleep · 3h`, `Sleeps in 3h 40m`, `Hibernation off`. */
export function hibernationStatusLabel(status: HibernationStatus): string {
  switch (status.kind) {
    case 'asleep':
      return `Asleep · ${hibernationDuration(status.asleepMs)}`
    case 'armed':
      if (status.remainingMs === null) return `Sleeps after ${hibernationDuration(status.timeoutMs)}`
      // Past its timeout with the sweep not yet run: promising a countdown that
      // has already elapsed reads as broken.
      return status.remainingMs === 0
        ? 'Sleeps on the next check'
        : `Sleeps in ${hibernationDuration(status.remainingMs)}`
    case 'off':
      return 'Hibernation off'
  }
}

/** The line under it — the "idle for 20m of a 4h timeout" sentence. */
export function hibernationDetail(status: HibernationStatus): string {
  switch (status.kind) {
    case 'asleep':
      return SLEEPING_URL_NOTE
    case 'armed': {
      const timeout = hibernationDuration(status.timeoutMs)
      return status.idleMs === null
        ? `Sleeps once nothing has hit its URL for ${timeout}`
        : `Idle for ${hibernationDuration(status.idleMs)} of a ${timeout} timeout`
    }
    case 'off':
      return 'Stays up whether or not anything is using it'
  }
}

/** `Asleep · 3h`, or nothing at all when the environment is awake. */
export function sleepBadgeLabel(
  h: EnvironmentHibernation | null | undefined,
  now: number,
): string {
  const status = hibernationStatus(h, now)
  return status.kind === 'asleep' ? hibernationStatusLabel(status) : ''
}

/**
 * The board's version. Its columns are already reserved for the lock, the
 * findings flag and the checklist, and a fourth wide enough for `Asleep · 3h`
 * crushes the branch column it sits next to — so the word goes to the tooltip
 * and only the duration stays on the row.
 */
export function sleepBadgeCompactLabel(
  h: EnvironmentHibernation | null | undefined,
  now: number,
): string {
  const status = hibernationStatus(h, now)
  return status.kind === 'asleep' ? hibernationDuration(status.asleepMs) : ''
}

export function sleepBadgeTitle(
  h: EnvironmentHibernation | null | undefined,
  now: number,
): string {
  const status = hibernationStatus(h, now)
  if (status.kind !== 'asleep') return ''
  return `Asleep for ${hibernationDuration(status.asleepMs)} — its containers are stopped, so the URL returns 404 until it is woken`
}

export type HibernationFailure =
  | { kind: 'locked'; lock: EnvironmentLock }
  | { kind: 'no-deployment' }
  | { kind: 'no-containers' }
  | { kind: 'deploy-in-flight' }
  | { kind: 'worker-unreachable' }
  | { kind: 'other'; message: string }

/**
 * Every refusal the two action endpoints can produce, told apart.
 *
 * The lock case delegates to `lockConflict` rather than re-reading the body:
 * hibernation returns the identical `ENVIRONMENT_LOCKED` payload a refused
 * deploy does, so there is one parser for it and one place to fix.
 *
 * The rest share a bare 409 with no code of their own, so they are separated on
 * the server's message — and anything unrecognised falls through with that
 * message intact rather than being flattened into a generic failure.
 */
export function hibernationFailure(error: unknown, fallback: string): HibernationFailure {
  const lock = lockConflict(error)
  if (lock) return { kind: 'locked', lock }

  const status = isAxiosError(error) ? error.response?.status : undefined
  const message = apiErrorMessage(error, fallback)

  if (status === 409) {
    if (/no successful deployment/i.test(message)) return { kind: 'no-deployment' }
    if (/in progress/i.test(message)) return { kind: 'deploy-in-flight' }
    if (/no running containers/i.test(message)) return { kind: 'no-containers' }
  }
  if (status === 404 && /no containers/i.test(message)) return { kind: 'no-containers' }
  if (status === 502) return { kind: 'worker-unreachable' }

  return { kind: 'other', message }
}

export function hibernationFailureMessage(failure: HibernationFailure): string {
  switch (failure.kind) {
    case 'locked':
      return `${lockHolderName(failure.lock.lockedBy)} has this environment locked — they are testing on it`
    case 'no-deployment':
      return 'Nothing to wake — this environment has never deployed successfully'
    case 'no-containers':
      return 'Nothing to stop — this environment has no running containers'
    case 'deploy-in-flight':
      return 'A deploy is in flight — let it finish before sleeping this environment'
    case 'worker-unreachable':
      return 'The deploy worker is unreachable — nothing was stopped or started'
    case 'other':
      return failure.message
  }
}

/** One call for a catch block: classify, then say it. */
export function hibernationErrorMessage(error: unknown, fallback: string): string {
  return hibernationFailureMessage(hibernationFailure(error, fallback))
}

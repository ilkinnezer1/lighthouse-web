import type { Component } from 'vue'
import { Ban, CircleCheck, CircleX, LoaderCircle } from '@lucide/vue'
import type { DatabaseStatus, SnapshotStatus } from '@/types/api'

export { titleCase } from '@/lib/utils'

export type StatusTone = 'active' | 'success' | 'error' | 'neutral'

export const databaseTone: Record<DatabaseStatus, StatusTone> = {
  PROVISIONING: 'active',
  READY: 'success',
  FAILED: 'error',
}

export const snapshotTone: Record<SnapshotStatus, StatusTone> = {
  PENDING: 'active',
  READY: 'success',
  FAILED: 'error',
}

/**
 * What to show for a database, given both what the control plane recorded and
 * whether its container is actually running.
 *
 * `status` only records how provisioning ended, so a container stopped later —
 * by a reboot, or by hand — leaves a row reading READY for a database nothing
 * can reach. A green tick there is worse than no badge at all: it sends someone
 * debugging their own connection string.
 *
 * `containerRunning === null` means the worker could not be asked, or the
 * database is an attached one we do not run. Unknown is not the same as stopped,
 * so the recorded status stands.
 */
export function databaseDisplay(db: {
  status: DatabaseStatus
  containerRunning?: boolean | null
}): { tone: StatusTone; label: string; note?: string } {
  if (db.status === 'READY' && db.containerRunning === false) {
    return {
      tone: 'neutral',
      label: 'Stopped',
      note: 'Provisioned, but its container is not running — start it before connecting.',
    }
  }
  return { tone: databaseTone[db.status], label: titleCaseStatus(db.status) }
}

function titleCaseStatus(s: DatabaseStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

// A DB/snapshot keeps mutating server-side until it leaves these states.
export function isDatabasePending(s: DatabaseStatus): boolean {
  return s === 'PROVISIONING'
}

export function isSnapshotPending(s: SnapshotStatus): boolean {
  return s === 'PENDING'
}

export const toneClass: Record<StatusTone, string> = {
  active: 'bg-primary/15 text-primary',
  success: 'bg-success/15 text-success',
  error: 'bg-destructive/15 text-destructive',
  neutral: 'bg-muted text-muted-foreground',
}

export const toneIcon: Record<StatusTone, Component> = {
  active: LoaderCircle,
  success: CircleCheck,
  error: CircleX,
  neutral: Ban,
}

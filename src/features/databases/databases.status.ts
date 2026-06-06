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

import type { DeploymentStageStatus, DeploymentStatus } from '@/types/api'

export { titleCase } from '@/lib/utils'

export type StatusTone = 'queued' | 'active' | 'success' | 'error' | 'neutral'

const TERMINAL: readonly string[] = ['SUCCEEDED', 'FAILED', 'CANCELLED']

export function isTerminalStatus(s: DeploymentStatus): boolean {
  return TERMINAL.includes(s)
}

export const statusTone: Record<DeploymentStatus, StatusTone> = {
  QUEUED: 'queued',
  CLONING: 'active',
  BUILDING: 'active',
  PUSHING: 'active',
  STARTING: 'active',
  RUNNING: 'active',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'neutral',
}

export const stageTone: Record<DeploymentStageStatus, StatusTone> = {
  PENDING: 'neutral',
  RUNNING: 'active',
  SUCCEEDED: 'success',
  FAILED: 'error',
  SKIPPED: 'neutral',
  ROLLED_BACK: 'error',
}

export const statusDotClass: Record<StatusTone, string> = {
  queued: 'bg-signal-idle',
  active: 'bg-signal-progress animate-pulse',
  success: 'bg-signal-live',
  error: 'bg-signal-error',
  neutral: 'bg-signal-idle',
}

// Terminal success stays ink, not green — a list of ten "Succeeded" rows in
// colour is noise. Only the states you'd act on carry a hue.
export const statusTextClass: Record<StatusTone, string> = {
  queued: 'text-ink-4',
  active: 'text-signal-progress',
  success: 'text-ink-3',
  error: 'text-signal-error',
  neutral: 'text-ink-4',
}

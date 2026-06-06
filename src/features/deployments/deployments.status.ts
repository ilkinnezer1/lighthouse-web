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
  queued: 'bg-muted-foreground/40',
  active: 'bg-primary animate-pulse',
  success: 'bg-success',
  error: 'bg-destructive',
  neutral: 'bg-muted-foreground/40',
}

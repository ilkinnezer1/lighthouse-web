import type { DeploymentStageStatus, DeploymentStatus } from '@/types/api'

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

export function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

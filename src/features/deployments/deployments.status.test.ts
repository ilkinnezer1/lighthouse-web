import { describe, expect, it } from 'vitest'
import type { DeploymentStageStatus, DeploymentStatus } from '@/types/api'
import {
  isTerminalStatus,
  stageTone,
  statusDotClass,
  statusTextClass,
  statusTone,
  titleCase,
} from './deployments.status'

const ALL_STATUSES: DeploymentStatus[] = [
  'QUEUED',
  'CLONING',
  'BUILDING',
  'PUSHING',
  'STARTING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]

const ALL_STAGE_STATUSES: DeploymentStageStatus[] = [
  'PENDING',
  'RUNNING',
  'SUCCEEDED',
  'FAILED',
  'SKIPPED',
  'ROLLED_BACK',
]

describe('isTerminalStatus', () => {
  it('treats only SUCCEEDED, FAILED and CANCELLED as terminal', () => {
    const terminal = ALL_STATUSES.filter(isTerminalStatus)
    expect(terminal).toEqual(['SUCCEEDED', 'FAILED', 'CANCELLED'])
  })

  it('treats RUNNING as still in flight, since the deploy is not settled', () => {
    expect(isTerminalStatus('RUNNING')).toBe(false)
  })
})

describe('statusTone', () => {
  it('maps every deployment status', () => {
    for (const s of ALL_STATUSES) expect(statusTone[s]).toBeDefined()
  })

  it('groups the in-flight pipeline statuses under one active tone', () => {
    for (const s of ['CLONING', 'BUILDING', 'PUSHING', 'STARTING', 'RUNNING'] as const) {
      expect(statusTone[s]).toBe('active')
    }
  })

  it('separates cancelled from failed', () => {
    expect(statusTone.FAILED).toBe('error')
    expect(statusTone.CANCELLED).toBe('neutral')
  })
})

describe('stageTone', () => {
  it('maps every stage status', () => {
    for (const s of ALL_STAGE_STATUSES) expect(stageTone[s]).toBeDefined()
  })

  it('renders a pending and a skipped stage identically', () => {
    expect(stageTone.PENDING).toBe(stageTone.SKIPPED)
  })

  it('treats a rolled-back stage as an error', () => {
    expect(stageTone.ROLLED_BACK).toBe('error')
  })
})

describe('tone class maps', () => {
  it('cover every tone the status and stage maps can produce', () => {
    const tones = new Set([...Object.values(statusTone), ...Object.values(stageTone)])
    for (const tone of tones) {
      expect(statusDotClass[tone]).toBeTruthy()
      expect(statusTextClass[tone]).toBeTruthy()
    }
  })

  it('animates only the active dot', () => {
    const animated = Object.entries(statusDotClass)
      .filter(([, cls]) => cls.includes('animate-pulse'))
      .map(([tone]) => tone)
    expect(animated).toEqual(['active'])
  })

  it('keeps terminal success ink-coloured rather than green', () => {
    expect(statusTextClass.success).toBe('text-ink-3')
  })
})

describe('titleCase re-export', () => {
  it('is the shared helper, so stage labels match the rest of the app', () => {
    expect(titleCase('BUILDING')).toBe('Building')
  })
})

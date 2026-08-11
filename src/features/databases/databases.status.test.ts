import { describe, expect, it } from 'vitest'
import type { DatabaseStatus, SnapshotStatus } from '@/types/api'
import {
  databaseDisplay,
  databaseTone,
  isDatabasePending,
  isSnapshotPending,
  snapshotTone,
  toneClass,
  toneIcon,
} from './databases.status'

const ALL_DB_STATUSES: DatabaseStatus[] = ['PROVISIONING', 'READY', 'FAILED']
const ALL_SNAPSHOT_STATUSES: SnapshotStatus[] = ['PENDING', 'READY', 'FAILED']

describe('databaseDisplay', () => {
  it('overrides a READY database whose container is not running', () => {
    const display = databaseDisplay({ status: 'READY', containerRunning: false })
    expect(display.tone).toBe('neutral')
    expect(display.label).toBe('Stopped')
    expect(display.note).toContain('start it before connecting')
  })

  it('trusts the recorded status when the container state is unknown', () => {
    for (const containerRunning of [null, undefined]) {
      const display = databaseDisplay({ status: 'READY', containerRunning })
      expect(display.tone).toBe('success')
      expect(display.label).toBe('Ready')
      expect(display.note).toBeUndefined()
    }
  })

  it('reports a running READY database as ready', () => {
    expect(databaseDisplay({ status: 'READY', containerRunning: true })).toEqual({
      tone: 'success',
      label: 'Ready',
    })
  })

  it('does not apply the stopped override to non-READY statuses', () => {
    expect(databaseDisplay({ status: 'PROVISIONING', containerRunning: false })).toEqual({
      tone: 'active',
      label: 'Provisioning',
    })
    expect(databaseDisplay({ status: 'FAILED', containerRunning: false })).toEqual({
      tone: 'error',
      label: 'Failed',
    })
  })

  it('title-cases every status label', () => {
    for (const status of ALL_DB_STATUSES) {
      const { label } = databaseDisplay({ status, containerRunning: null })
      expect(label).toBe(status.charAt(0) + status.slice(1).toLowerCase())
    }
  })
})

describe('pending predicates', () => {
  it('marks only PROVISIONING databases as still mutating', () => {
    expect(ALL_DB_STATUSES.filter(isDatabasePending)).toEqual(['PROVISIONING'])
  })

  it('marks only PENDING snapshots as still mutating', () => {
    expect(ALL_SNAPSHOT_STATUSES.filter(isSnapshotPending)).toEqual(['PENDING'])
  })
})

describe('tone maps', () => {
  it('map every database and snapshot status', () => {
    for (const s of ALL_DB_STATUSES) expect(databaseTone[s]).toBeDefined()
    for (const s of ALL_SNAPSHOT_STATUSES) expect(snapshotTone[s]).toBeDefined()
  })

  it('give the stopped override a class and an icon to render with', () => {
    expect(toneClass.neutral).toBeTruthy()
    expect(toneIcon.neutral).toBeTruthy()
  })

  it('cover every tone reachable from a status', () => {
    const tones = new Set([...Object.values(databaseTone), ...Object.values(snapshotTone)])
    for (const tone of tones) {
      expect(toneClass[tone]).toBeTruthy()
      expect(toneIcon[tone]).toBeTruthy()
    }
  })
})

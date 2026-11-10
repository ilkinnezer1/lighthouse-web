import { describe, expect, it } from 'vitest'
import { AxiosError, AxiosHeaders } from 'axios'
import type { DatabaseType, ImportStatus, SnapshotStatus } from '@/types/api'
import {
  importAccept,
  importErrorMessage,
  isAcceptedImportFile,
  isImportInFlight,
  snapshotDisplay,
  snapshotFailed,
  supportsImport,
} from './snapshots.import'

function httpError(status: number, data: unknown): AxiosError {
  const err = new AxiosError(`Request failed with status code ${status}`)
  err.response = {
    status,
    statusText: '',
    data,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  }
  return err
}

describe('import accept by engine', () => {
  it('offers .sql and .sql.gz for MySQL', () => {
    expect(importAccept('MYSQL')).toBe('.sql,.sql.gz')
  })

  it('adds the custom-format .dump for Postgres', () => {
    expect(importAccept('POSTGRES')).toBe('.sql,.sql.gz,.dump')
  })

  it('supports only MySQL and Postgres', () => {
    const all: DatabaseType[] = ['POSTGRES', 'MYSQL', 'REDIS', 'MONGO']
    expect(all.filter(supportsImport)).toEqual(['POSTGRES', 'MYSQL'])
    expect(importAccept('REDIS')).toBe('')
  })

  it('matches file names case-insensitively, including the double extension', () => {
    expect(isAcceptedImportFile('wj_dev3.sql', 'MYSQL')).toBe(true)
    expect(isAcceptedImportFile('WJ_DEV3.SQL.GZ', 'MYSQL')).toBe(true)
    expect(isAcceptedImportFile('prod.dump', 'POSTGRES')).toBe(true)
  })

  it('rejects what the engine cannot load', () => {
    expect(isAcceptedImportFile('prod.dump', 'MYSQL')).toBe(false)
    expect(isAcceptedImportFile('data.gz', 'POSTGRES')).toBe(false)
    expect(isAcceptedImportFile('backup.sql.zip', 'MYSQL')).toBe(false)
    expect(isAcceptedImportFile('dump.rdb', 'REDIS')).toBe(false)
  })
})

describe('snapshotDisplay', () => {
  const importCases: [ImportStatus, string, string][] = [
    ['UPLOADING', 'active', 'Uploading'],
    ['RESTORING', 'active', 'Restoring'],
    ['SUCCEEDED', 'success', 'Imported'],
    ['FAILED', 'error', 'Failed'],
  ]

  it.each(importCases)(
    'shows an import that is %s by its import status',
    (importStatus, tone, label) => {
      expect(snapshotDisplay({ status: 'READY', origin: 'IMPORT', importStatus })).toEqual({
        tone,
        label,
      })
    },
  )

  it('keeps the snapshot status for dumps', () => {
    const cases: [SnapshotStatus, string, string][] = [
      ['PENDING', 'active', 'Pending'],
      ['READY', 'success', 'Ready'],
      ['FAILED', 'error', 'Failed'],
    ]
    for (const [status, tone, label] of cases) {
      expect(snapshotDisplay({ status, origin: 'DUMP', importStatus: null })).toEqual({
        tone,
        label,
      })
    }
  })

  it('falls back to the snapshot status for an import without one', () => {
    expect(snapshotDisplay({ status: 'PENDING', origin: 'IMPORT', importStatus: null }).label).toBe(
      'Pending',
    )
  })
})

describe('import progress predicates', () => {
  it('is in flight only while uploading or restoring', () => {
    expect(isImportInFlight({ importStatus: 'UPLOADING' })).toBe(true)
    expect(isImportInFlight({ importStatus: 'RESTORING' })).toBe(true)
    expect(isImportInFlight({ importStatus: 'SUCCEEDED' })).toBe(false)
    expect(isImportInFlight({ importStatus: 'FAILED' })).toBe(false)
    expect(isImportInFlight({ importStatus: null })).toBe(false)
  })

  it('treats a failed restore of a stored dump as failed', () => {
    expect(snapshotFailed({ status: 'READY', importStatus: 'FAILED' })).toBe(true)
    expect(snapshotFailed({ status: 'FAILED', importStatus: null })).toBe(true)
    expect(snapshotFailed({ status: 'READY', importStatus: 'SUCCEEDED' })).toBe(false)
  })
})

describe('importErrorMessage', () => {
  it('prefers the server message', () => {
    expect(importErrorMessage(httpError(409, { message: 'An import is already running' }))).toBe(
      'An import is already running',
    )
    expect(importErrorMessage(httpError(400, { message: 'Unsupported file type' }))).toBe(
      'Unsupported file type',
    )
  })

  it('explains a bare 413 and 411', () => {
    expect(importErrorMessage(httpError(413, ''))).toContain('larger than the import limit')
    expect(importErrorMessage(httpError(411, undefined))).toContain('without a size')
  })

  it('reports a dropped connection as a network error', () => {
    expect(importErrorMessage(new AxiosError('Network Error'))).toContain('Network error')
  })
})

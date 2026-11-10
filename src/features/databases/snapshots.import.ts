import { AxiosError } from 'axios'
import { apiErrorMessage } from '@/lib/api'
import type { DatabaseSnapshot, DatabaseType, ImportStatus } from '@/types/api'
import { snapshotTone, titleCase, type StatusTone } from './databases.status'

const IMPORT_EXTENSIONS: Partial<Record<DatabaseType, readonly string[]>> = {
  MYSQL: ['.sql', '.sql.gz'],
  POSTGRES: ['.sql', '.sql.gz', '.dump'],
}

export function importExtensions(type: DatabaseType): readonly string[] {
  return IMPORT_EXTENSIONS[type] ?? []
}

export function supportsImport(type: DatabaseType): boolean {
  return importExtensions(type).length > 0
}

export function importAccept(type: DatabaseType): string {
  return importExtensions(type).join(',')
}

export function isAcceptedImportFile(fileName: string, type: DatabaseType): boolean {
  const name = fileName.toLowerCase()
  return importExtensions(type).some((ext) => name.endsWith(ext))
}

const importDisplay: Record<ImportStatus, { tone: StatusTone; label: string }> = {
  UPLOADING: { tone: 'active', label: 'Uploading' },
  RESTORING: { tone: 'active', label: 'Restoring' },
  SUCCEEDED: { tone: 'success', label: 'Imported' },
  FAILED: { tone: 'error', label: 'Failed' },
}

export function isImportInFlight(s: Pick<DatabaseSnapshot, 'importStatus'>): boolean {
  return s.importStatus === 'UPLOADING' || s.importStatus === 'RESTORING'
}

// An import's own lifecycle outlives the snapshot row's: the blob is READY long
// before the restore that loads it has finished, so its badge follows importStatus.
export function snapshotDisplay(s: Pick<DatabaseSnapshot, 'status' | 'origin' | 'importStatus'>): {
  tone: StatusTone
  label: string
} {
  if (s.origin === 'IMPORT' && s.importStatus) return importDisplay[s.importStatus]
  return { tone: snapshotTone[s.status], label: titleCase(s.status) }
}

export function snapshotFailed(s: Pick<DatabaseSnapshot, 'status' | 'importStatus'>): boolean {
  return s.status === 'FAILED' || s.importStatus === 'FAILED'
}

const importStatusFallback: Record<number, string> = {
  411: 'The upload was sent without a size. Try again from a current browser.',
  413: 'This file is larger than the import limit.',
}

export function importErrorMessage(error: unknown): string {
  if (error instanceof AxiosError && error.response) {
    const data = error.response.data as { message?: unknown } | undefined
    const fallback = importStatusFallback[error.response.status]
    if (!data?.message && fallback) return fallback
  }
  return apiErrorMessage(error, 'Could not import the dump')
}

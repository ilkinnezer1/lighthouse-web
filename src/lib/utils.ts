import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function shortSha(sha: string | null | undefined): string | null {
  return sha ? sha.slice(0, 7) : null
}

export function titleCase(s: string): string {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

// Docker reports -1 when it could not size a volume; "size unknown" beats a
// misleading 0 or a bare dash that reads as "no data". See VolumeInfo in types/api.
const SIZE_UNKNOWN = -1

// Render a byte count (API sends BigInt sizes as a decimal string) as a human size.
export function formatBytes(bytes: string | number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—'
  const n = typeof bytes === 'string' ? Number(bytes) : bytes
  if (n === SIZE_UNKNOWN) return 'size unknown'
  if (!Number.isFinite(n) || n < 0) return '—'
  if (n < 1024) return `${n} B`
  const units = ['KB', 'MB', 'GB', 'TB', 'PB']
  let value = n / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`
}

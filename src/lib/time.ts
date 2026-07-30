const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const units: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
]

export function relativeTime(iso: string): string {
  const diff = (Date.parse(iso) - Date.now()) / 1000
  const abs = Math.abs(diff)
  for (const [unit, secs] of units) {
    if (abs >= secs || unit === 'second') {
      return rtf.format(Math.round(diff / secs), unit)
    }
  }
  return ''
}

export function dayLabel(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const midnight = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const days = Math.round((midnight(now) - midnight(d)) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * "How long did it take" — the number you scan a build list for.
 * Returns null while a deployment is still running (no finish time yet).
 */
export function durationLabel(start: string | null, end: string | null): string | null {
  if (!start || !end) return null
  const ms = Date.parse(end) - Date.parse(start)
  if (!Number.isFinite(ms) || ms < 0) return null
  const secs = Math.round(ms / 1000)
  if (secs < 60) return `${secs}s`
  const mins = Math.floor(secs / 60)
  const rem = secs % 60
  if (mins < 60) return rem ? `${mins}m ${rem}s` : `${mins}m`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ${mins % 60}m`
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

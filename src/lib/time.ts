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

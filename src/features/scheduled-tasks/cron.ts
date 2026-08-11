// Friendly presets cover almost every real schedule; the raw field stays for
// anything else, because a cron expression is the honest escape hatch.
export const CRON_PRESETS: { label: string; value: string }[] = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Hourly', value: '0 * * * *' },
  { label: 'Daily at 03:00', value: '0 3 * * *' },
  { label: 'Weekly (Sun 03:00)', value: '0 3 * * 0' },
  { label: 'Monthly (1st, 03:00)', value: '0 3 1 * *' },
]

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/**
 * Plain-English summary of the common shapes. Falls back to the raw expression
 * rather than guessing — a wrong description is worse than none.
 */
export function describeCron(expr: string): string {
  const preset = CRON_PRESETS.find((p) => p.value === expr)
  if (preset) return preset.label

  const parts = expr.trim().split(/\s+/)
  if (parts.length !== 5) return expr
  const [min, hour, dom, mon, dow] = parts
  const at =
    /^\d+$/.test(min) && /^\d+$/.test(hour)
      ? `${hour.padStart(2, '0')}:${min.padStart(2, '0')}`
      : null

  if (at && dom === '*' && mon === '*' && dow === '*') return `Daily at ${at}`
  if (at && dom === '*' && mon === '*' && /^[0-6]$/.test(dow)) {
    return `Weekly on ${DOW[Number(dow)]} at ${at}`
  }
  if (at && /^\d+$/.test(dom) && mon === '*' && dow === '*') {
    return `Monthly on day ${dom} at ${at}`
  }
  if (/^\*\/\d+$/.test(min) && hour === '*') {
    return `Every ${min.slice(2)} minutes`
  }
  return expr
}

export function browserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

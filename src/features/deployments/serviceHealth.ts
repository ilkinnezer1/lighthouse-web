import type { ServiceHealth } from '@/types/api'

export type HealthTone = 'ok' | 'warn' | 'down'

// Maps the TRUE container state to a visual severity. `running` is the only OK
// state; transient/lifecycle states warn; anything stopped or unreachable is down.
const STATE_TONE: Record<ServiceHealth['state'], HealthTone> = {
  running: 'ok',
  restarting: 'warn',
  paused: 'warn',
  created: 'warn',
  exited: 'down',
  dead: 'down',
  missing: 'down',
}

export function healthTone(h: ServiceHealth): HealthTone {
  // An unhealthy/starting healthcheck overrides an otherwise-running container.
  if (h.state === 'running') {
    if (h.health === 'unhealthy') return 'down'
    if (h.health === 'starting') return 'warn'
    return 'ok'
  }
  return STATE_TONE[h.state] ?? 'warn'
}

export const healthDotClass: Record<HealthTone, string> = {
  ok: 'bg-success',
  warn: 'bg-amber-500 animate-pulse',
  down: 'bg-destructive animate-pulse',
}

export const healthTextClass: Record<HealthTone, string> = {
  ok: 'text-muted-foreground',
  warn: 'text-amber-500',
  down: 'text-destructive',
}

// The short human label for a row, e.g. "running", "unhealthy", "exited (137)".
export function healthLabel(h: ServiceHealth): string {
  if (h.state === 'running') {
    if (h.health === 'unhealthy') return 'unhealthy'
    if (h.health === 'starting') return 'starting'
    return 'running'
  }
  if (h.state === 'exited' || h.state === 'dead') return `${h.state} (${h.exitCode})`
  return h.state
}

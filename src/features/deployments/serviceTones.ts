import { ref } from 'vue'
import type { HealthTone } from './serviceHealth'

export type ServiceTones = Record<string, HealthTone>

// Live container tone per service (reported by each row's health badge), so the
// page reflects TRUE state rather than the possibly-stale DB `service.status`.
export function useServiceTones() {
  const tones = ref<ServiceTones>({})
  function setTone(name: string, tone: HealthTone) {
    tones.value = { ...tones.value, [name]: tone }
  }
  return { tones, setTone }
}

export function isServiceDown(
  tones: ServiceTones,
  svc: { name: string; status: string | null },
): boolean {
  const live = tones[svc.name]
  // Fall back to the DB status only until the live tone has been reported.
  return live ? live === 'down' : svc.status !== 'running'
}

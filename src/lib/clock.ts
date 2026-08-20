import { onScopeDispose, readonly, ref } from 'vue'

// One timer for the whole app. Lock countdowns are per-row, and a timer each
// would be N timers redrawing a value that only changes once a minute.
const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
let subscribers = 0

const TICK_MS = 30_000

/** A shared clock for anything counting down. Stops once nothing is watching. */
export function useNowMs() {
  subscribers++
  // Refreshed per subscriber, not just per timer: a countdown mounting between
  // two ticks would otherwise render a `now` up to a full interval stale.
  now.value = Date.now()
  if (!timer) {
    timer = setInterval(() => {
      now.value = Date.now()
    }, TICK_MS)
  }
  onScopeDispose(() => {
    subscribers--
    if (subscribers === 0 && timer) {
      clearInterval(timer)
      timer = null
    }
  })
  return readonly(now)
}

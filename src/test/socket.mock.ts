type Listener = (...args: never[]) => void
type AnyListener = (event: string, ...args: never[]) => void

// Stands in for a socket.io client so `useDeploymentLogs` runs for real against
// a driveable transport instead of opening a WebSocket.
export class FakeSocket {
  connected = true
  emitted: { event: string; payload: unknown }[] = []

  private listeners = new Map<string, Set<Listener>>()
  private anyListeners = new Set<AnyListener>()

  on(event: string, fn: Listener) {
    const set = this.listeners.get(event) ?? new Set<Listener>()
    set.add(fn)
    this.listeners.set(event, set)
    return this
  }

  off(event: string, fn?: Listener) {
    if (!fn) this.listeners.delete(event)
    else this.listeners.get(event)?.delete(fn)
    return this
  }

  onAny(fn: AnyListener) {
    this.anyListeners.add(fn)
    return this
  }

  offAny(fn?: AnyListener) {
    if (!fn) this.anyListeners.clear()
    else this.anyListeners.delete(fn)
    return this
  }

  emit(event: string, payload?: unknown, ack?: (res: { ok: boolean }) => void) {
    this.emitted.push({ event, payload })
    ack?.({ ok: true })
    return this
  }

  disconnect() {
    this.connected = false
    return this
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }

  serverEmit(event: string, ...args: never[]) {
    for (const fn of [...this.anyListeners]) fn(event, ...args)
    for (const fn of [...(this.listeners.get(event) ?? [])]) fn(...args)
  }
}

let latest: FakeSocket | null = null

export function io(): FakeSocket {
  latest = new FakeSocket()
  return latest
}

export function lastSocket(): FakeSocket {
  if (!latest) throw new Error('No socket was created — did the component subscribe?')
  return latest
}

export function resetSockets() {
  latest = null
}

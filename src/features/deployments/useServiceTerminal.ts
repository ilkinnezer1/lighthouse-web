import { ref, toValue, watch, type MaybeRefOrGetter, type Ref } from 'vue'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import { io, type Socket } from 'socket.io-client'

export type TerminalStatus = 'idle' | 'connecting' | 'ready' | 'closed' | 'error'

// Mirrors the API's ExecGateway (`src/ws/exec.gateway.ts`).
// Dev override: `VITE_EXEC_PATH=/exec-io` routes the engine.io connection
// through the Vite proxy to the local mock exec gateway. It still connects
// same-origin (no CORS) — only the socket.io `path` differs from production.
const EXEC_PATH = (import.meta.env.VITE_EXEC_PATH as string | undefined) || '/socket.io'
const NAMESPACE = '/exec'
const EXEC_START = 'exec:start'
const EXEC_INPUT = 'exec:input'
const EXEC_RESIZE = 'exec:resize'
const EXEC_STOP = 'exec:stop'
const EXEC_READY = 'exec:ready'
const EXEC_OUTPUT = 'exec:output'
const EXEC_EXIT = 'exec:exit'
const EXEC_ERROR = 'exec:error'

type StartAck = { ok: true } | { ok: false; error: string }

// Drives an interactive exec session for a single deployment service.
//
// Transport is a fresh socket.io connection on the `/exec` namespace —
// fresh-per-session so disconnecting cleanly tears down the worker-side PTY.
// Contract (cookie-authenticated, same as `/deployments`):
//   client → server  exec:start  { deploymentId, service, cols, rows } → ack
//                    exec:input  <bytes>             keystrokes
//                    exec:resize { cols, rows }
//                    exec:stop
//   server → client  exec:ready                      PTY attached
//                    exec:output <binary>            raw pty bytes
//                    exec:exit   { code }            process ended
//                    exec:error  { error }           worker-side failure
export function useServiceTerminal(
  container: Ref<HTMLElement | null>,
  deploymentId: MaybeRefOrGetter<string>,
  service: MaybeRefOrGetter<string | undefined>,
  opts: { active: MaybeRefOrGetter<boolean> },
) {
  const status = ref<TerminalStatus>('idle')
  const errorMessage = ref<string | null>(null)

  let term: Terminal | null = null
  let fit: FitAddon | null = null
  let socket: Socket | null = null
  let resizeObserver: ResizeObserver | null = null

  function doFit(): void {
    if (!fit || !term) return
    try {
      fit.fit()
    } catch {
      return
    }
    socket?.emit(EXEC_RESIZE, { cols: term.cols, rows: term.rows })
  }

  function mountTerminal(): void {
    if (term || !container.value) return
    term = new Terminal({
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
      fontSize: 13,
      cursorBlink: true,
      convertEol: true,
      theme: {
        background: '#0a0d14',
        foreground: '#d6dae3',
        cursor: '#f6a623',
        selectionBackground: '#2a3344',
      },
    })
    fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container.value)
    doFit()
    term.onData((d) => socket?.emit(EXEC_INPUT, d))
    resizeObserver = new ResizeObserver(() => doFit())
    resizeObserver.observe(container.value)
  }

  function connect(): void {
    const id = toValue(deploymentId)
    const svc = toValue(service)
    if (!id || !term) return

    socket?.disconnect()
    socket = null
    status.value = 'connecting'
    errorMessage.value = null

    // A terminal session shouldn't silently retry forever — fail fast and let
    // the user hit Reconnect. Same-origin; `path` selects real API vs mock.
    const sock = io(NAMESPACE, {
      path: EXEC_PATH,
      withCredentials: true,
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: false,
      timeout: 8000,
    })
    socket = sock

    sock.on('connect', () => {
      sock.emit(
        EXEC_START,
        { deploymentId: id, service: svc, cols: term!.cols, rows: term!.rows },
        (ack: StartAck) => {
          if (!ack?.ok) {
            status.value = 'error'
            errorMessage.value = ack?.error ?? 'Could not start the terminal session.'
            sock.disconnect()
          }
        },
      )
    })
    sock.on(EXEC_READY, () => {
      status.value = 'ready'
      term?.focus()
      doFit()
    })
    sock.on(EXEC_OUTPUT, (data: ArrayBuffer | Uint8Array | string) => {
      term?.write(typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer))
    })
    sock.on(EXEC_EXIT, ({ code }: { code?: number }) => {
      status.value = 'closed'
      const suffix = code != null && code >= 0 ? ` with code ${code}` : ''
      term?.write(`\r\n\x1b[90m[session ended${suffix}]\x1b[0m\r\n`)
    })
    sock.on(EXEC_ERROR, ({ error }: { error?: string }) => {
      status.value = 'error'
      errorMessage.value = error ?? 'Terminal session failed.'
    })
    sock.on('connect_error', () => {
      status.value = 'error'
      errorMessage.value = 'Could not reach the terminal gateway.'
    })
    sock.on('disconnect', () => {
      if (status.value === 'ready' || status.value === 'connecting') status.value = 'closed'
    })
  }

  function teardown(): void {
    if (socket?.connected) socket.emit(EXEC_STOP)
    socket?.disconnect()
    socket = null
    resizeObserver?.disconnect()
    resizeObserver = null
    term?.dispose()
    term = null
    fit = null
    status.value = 'idle'
    errorMessage.value = null
  }

  watch(
    () => [toValue(opts.active), toValue(deploymentId), toValue(service)] as const,
    ([active, id]) => {
      teardown()
      if (active && id) {
        mountTerminal()
        connect()
      }
    },
    { flush: 'post' },
  )

  return { status, errorMessage, retry: connect, fit: doFit, teardown }
}

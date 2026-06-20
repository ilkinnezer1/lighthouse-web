import { onScopeDispose, ref } from 'vue'
import { runDeploymentAction } from './deployments.api'
import type { MaintenanceActionDef } from '@/types/api'

export type ActionStatus = 'idle' | 'running' | 'succeeded' | 'failed' | 'error'

// The worker terminates the stream with a record-separator-framed JSON line:
//   \x1e{"exitCode":N}\n
const RS = '\x1e'

// Runs one maintenance action at a time, streaming its output line-by-line over
// HTTP (same fetch+ReadableStream idiom as useRuntimeLogs) and resolving a final
// status from the trailing exit frame.
export function useDeploymentAction(deploymentId: () => string) {
  const status = ref<ActionStatus>('idle')
  const lines = ref<string[]>([])
  const exitCode = ref<number | null>(null)
  const errorMessage = ref<string | null>(null)
  const activeAction = ref<MaintenanceActionDef | null>(null)

  let controller: AbortController | null = null

  function stop(): void {
    controller?.abort()
    controller = null
  }

  function reset(): void {
    stop()
    status.value = 'idle'
    lines.value = []
    exitCode.value = null
    errorMessage.value = null
    activeAction.value = null
  }

  function handleLine(line: string): void {
    const rs = line.indexOf(RS)
    if (rs === -1) {
      lines.value.push(line)
      return
    }
    // Output may precede the control frame on the same chunk (commands don't
    // always end on a newline); split it off rather than assuming line start.
    if (rs > 0) lines.value.push(line.slice(0, rs))
    try {
      const frame = JSON.parse(line.slice(rs + 1)) as { exitCode?: number }
      exitCode.value = frame.exitCode ?? null
      status.value = frame.exitCode === 0 ? 'succeeded' : 'failed'
    } catch {
      // malformed control frame — ignore
    }
  }

  async function run(action: MaintenanceActionDef): Promise<void> {
    stop()
    lines.value = []
    exitCode.value = null
    errorMessage.value = null
    activeAction.value = action
    status.value = 'running'

    const ac = new AbortController()
    controller = ac

    try {
      const res = await runDeploymentAction(deploymentId(), action.id, ac.signal)
      if (!res.ok || !res.body) {
        status.value = 'error'
        errorMessage.value = `Could not start the action (${res.status}).`
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? '' // keep the trailing partial line
        for (const line of parts) handleLine(line)
      }
      if (buf) handleLine(buf)
      // Stream closed without an exit frame (e.g. worker hiccup): don't claim success.
      if (status.value === 'running') {
        status.value = 'failed'
        errorMessage.value = 'Stream ended before the command reported an exit code.'
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        status.value = 'error'
        errorMessage.value = (e as Error).message || 'Stream error.'
      }
    } finally {
      if (controller === ac) controller = null
    }
  }

  onScopeDispose(stop)

  return { status, lines, exitCode, errorMessage, activeAction, run, stop, reset }
}

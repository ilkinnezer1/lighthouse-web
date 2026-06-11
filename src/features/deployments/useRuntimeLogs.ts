import { type MaybeRefOrGetter, onScopeDispose, ref, toValue, watch } from 'vue'

// Streams a running deployment's container stdout/stderr (`docker logs -f`).
// The API proxies the worker's chunked HTTP stream; we read it with fetch +
// ReadableStream and split on newlines. The same-origin `/api` proxy carries
// the session cookie, so no extra auth wiring is needed.
//
// Gated by `enabled`: we only open the stream (which makes the worker run
// `docker logs --follow`) while the caller is actually looking, and abort it —
// stopping the worker tail — the moment they aren't.
export function useRuntimeLogs(
  deploymentId: MaybeRefOrGetter<string>,
  opts: {
    enabled: MaybeRefOrGetter<boolean>
    tail?: number
  },
) {
  const lines = ref<string[]>([])
  const streaming = ref(false)
  const error = ref<string | null>(null)

  let controller: AbortController | null = null

  async function start(id: string): Promise<void> {
    stop()
    lines.value = []
    error.value = null
    const ac = new AbortController()
    controller = ac

    const tail = opts.tail ?? 200
    try {
      const res = await fetch(`/api/deployments/${id}/runtime-logs?tail=${tail}`, {
        credentials: 'include',
        signal: ac.signal,
        headers: { Accept: 'text/plain' },
      })
      if (res.status === 404) {
        error.value = 'No running container for this deployment.'
        return
      }
      if (!res.ok || !res.body) {
        error.value = `Could not start log stream (${res.status}).`
        return
      }

      streaming.value = true
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n')
        buf = parts.pop() ?? '' // keep the trailing partial line
        for (const line of parts) lines.value.push(line)
      }
      if (buf) lines.value.push(buf)
    } catch (e) {
      // Aborts (navigation / toggling off) are expected; surface real failures.
      if ((e as Error).name !== 'AbortError') {
        error.value = (e as Error).message || 'Log stream error.'
      }
    } finally {
      if (controller === ac) {
        streaming.value = false
        controller = null
      }
    }
  }

  function stop(): void {
    controller?.abort()
    controller = null
    streaming.value = false
  }

  function restart(): void {
    const id = toValue(deploymentId)
    if (id && toValue(opts.enabled)) void start(id)
  }

  watch(
    () => [toValue(deploymentId), toValue(opts.enabled)] as const,
    ([id, enabled]) => {
      stop()
      if (id && enabled) void start(id)
    },
    { immediate: true },
  )

  onScopeDispose(stop)

  return { lines, streaming, error, restart, stop }
}

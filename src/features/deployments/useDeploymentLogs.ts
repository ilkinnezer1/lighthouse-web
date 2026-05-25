import { type MaybeRefOrGetter, onScopeDispose, ref, toValue, watch } from 'vue'
import type { Socket } from 'socket.io-client'
import { getDeploymentsSocket } from '@/lib/socket'
import type { LogEntry } from '@/types/api'

type SubscribeAck = { ok: boolean; error?: string }

// Streams a deployment's logs over the `/deployments` socket.io namespace.
// `onDeploymentEvent` fires on any `deployment.*` outbox event so the caller can
// refetch authoritative status/stages (we don't decode every worker event type).
export function useDeploymentLogs(
  deploymentId: MaybeRefOrGetter<string>,
  onDeploymentEvent?: () => void,
) {
  const logs = ref<LogEntry[]>([])
  const connected = ref(false)
  const error = ref<string | null>(null)

  let socket: Socket | null = null
  let currentId: string | null = null

  const onLog = (entry: LogEntry) => logs.value.push(entry)
  const onAny = (event: string) => {
    if (event !== 'log' && event.startsWith('deployment.')) onDeploymentEvent?.()
  }
  const onConnect = () => {
    connected.value = true
    subscribe()
  }
  const onDisconnect = () => {
    connected.value = false
  }

  function subscribe() {
    if (!socket || !currentId) return
    socket.emit('subscribe', { deploymentId: currentId }, (ack: SubscribeAck) => {
      error.value = ack?.ok ? null : (ack?.error ?? 'subscribe failed')
    })
  }

  function start(id: string) {
    logs.value = []
    error.value = null
    currentId = id
    socket = getDeploymentsSocket()
    socket.on('log', onLog)
    socket.onAny(onAny)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (socket.connected) {
      connected.value = true
      subscribe()
    }
  }

  function stop() {
    if (!socket) return
    if (currentId) socket.emit('unsubscribe', { deploymentId: currentId })
    socket.off('log', onLog)
    socket.offAny(onAny)
    socket.off('connect', onConnect)
    socket.off('disconnect', onDisconnect)
    socket = null
    currentId = null
  }

  watch(
    () => toValue(deploymentId),
    (id) => {
      stop()
      if (id) start(id)
    },
    { immediate: true },
  )

  onScopeDispose(stop)

  return { logs, connected, error }
}

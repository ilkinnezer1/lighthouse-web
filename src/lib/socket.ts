import { io, type Socket } from 'socket.io-client'

// `/deployments` namespace; the gateway authenticates from the session cookie.
let socket: Socket | null = null

export function getDeploymentsSocket(): Socket {
  if (!socket) {
    socket = io('/deployments', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }
  return socket
}

export function disconnectDeploymentsSocket() {
  socket?.disconnect()
  socket = null
}

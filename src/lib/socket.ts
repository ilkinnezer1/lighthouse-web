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

// `/notifications` namespace. Unlike `/deployments` there is nothing to
// subscribe to: the room is the authenticated user, known at handshake, so the
// gateway joins it on connect.
let notifications: Socket | null = null

export function getNotificationsSocket(): Socket {
  if (!notifications) {
    notifications = io('/notifications', {
      withCredentials: true,
      transports: ['websocket', 'polling'],
    })
  }
  return notifications
}

export function disconnectNotificationsSocket() {
  notifications?.disconnect()
  notifications = null
}

import { afterEach, vi } from 'vitest'
import { disconnectDeploymentsSocket } from '@/lib/socket'
import { resetSockets } from './socket.mock'

vi.mock('socket.io-client', () => import('./socket.mock'))

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

// reka-ui's dismissable/focus layers reach for pointer-capture APIs jsdom lacks.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

URL.createObjectURL = () => 'blob:test'
URL.revokeObjectURL = () => {}

// xterm probes a 2d context at import time; jsdom has no canvas backend.
HTMLCanvasElement.prototype.getContext = (() => null) as HTMLCanvasElement['getContext']

afterEach(() => {
  disconnectDeploymentsSocket()
  resetSockets()
  localStorage.clear()
  document.body.innerHTML = ''
  document.title = ''
})

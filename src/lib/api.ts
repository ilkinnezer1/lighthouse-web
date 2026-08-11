import axios, { AxiosError } from 'axios'

declare module 'axios' {
  export interface AxiosRequestConfig {
    skipAuthRedirect?: boolean
  }
}

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

let onUnauthorized: (() => void) | null = null

export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn
}

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && !error.config?.skipAuthRedirect) {
      onUnauthorized?.()
    }
    return Promise.reject(error)
  },
)

export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof AxiosError) {
    if (!error.response) return 'Network error — is the API running?'
    const data = error.response.data as { message?: string | string[] } | undefined
    if (data?.message) {
      return Array.isArray(data.message) ? data.message.join(' ') : data.message
    }
    if (error.response.status >= 500) return 'Server error. Try again shortly.'
    if (error.message) return error.message
  }
  return fallback
}

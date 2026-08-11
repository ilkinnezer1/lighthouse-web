import {
  AxiosError,
  AxiosHeaders,
  type AxiosAdapter,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios'
import { api } from '@/lib/api'

export interface ApiCall {
  method: string
  url: string
  body: unknown
  params: Record<string, unknown> | undefined
}

export interface ApiReply {
  status?: number
  data?: unknown
}

type Reply = ApiReply | ((call: ApiCall) => ApiReply)

interface Route {
  method: string
  matches: (url: string) => boolean
  reply: Reply
}

function parseBody(data: unknown): unknown {
  if (typeof data !== 'string') return data
  try {
    return JSON.parse(data)
  } catch {
    return data
  }
}

/**
 * Replaces the shared axios instance's adapter, so tests exercise the real
 * `*.api.ts` functions, interceptors and vue-query wiring and only the HTTP
 * round trip is faked.
 */
export function installApiMock() {
  const routes: Route[] = []
  const calls: ApiCall[] = []
  const previous = api.defaults.adapter

  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const method = (config.method ?? 'get').toLowerCase()
    const url = config.url ?? ''
    const call: ApiCall = {
      method,
      url,
      body: parseBody(config.data),
      params: config.params as Record<string, unknown> | undefined,
    }
    calls.push(call)

    const route = routes.find((r) => r.method === method && r.matches(url))
    if (!route) {
      return Promise.reject(
        new Error(`No API mock route for ${method.toUpperCase()} ${url}. Register one first.`),
      )
    }

    const { status = 200, data } =
      typeof route.reply === 'function' ? route.reply(call) : route.reply
    const response: AxiosResponse = {
      data,
      status,
      statusText: '',
      headers: new AxiosHeaders(),
      config,
      request: {},
    }
    if (status >= 200 && status < 300) return Promise.resolve(response)
    return Promise.reject(
      new AxiosError(
        `Request failed with status code ${status}`,
        String(status),
        config,
        {},
        response,
      ),
    )
  }

  api.defaults.adapter = adapter

  function register(method: string, url: string | RegExp, reply: Reply) {
    routes.unshift({
      method,
      matches: (u) => (typeof url === 'string' ? u === url : url.test(u)),
      reply,
    })
    return handle
  }

  const handle = {
    get: (url: string | RegExp, reply: Reply) => register('get', url, reply),
    post: (url: string | RegExp, reply: Reply) => register('post', url, reply),
    patch: (url: string | RegExp, reply: Reply) => register('patch', url, reply),
    put: (url: string | RegExp, reply: Reply) => register('put', url, reply),
    delete: (url: string | RegExp, reply: Reply) => register('delete', url, reply),
    calls,
    callsTo(method: string, url: string | RegExp): ApiCall[] {
      return calls.filter(
        (c) => c.method === method && (typeof url === 'string' ? c.url === url : url.test(c.url)),
      )
    },
    restore() {
      api.defaults.adapter = previous
    },
  }

  return handle
}

export type ApiMock = ReturnType<typeof installApiMock>

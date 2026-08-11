import { AxiosError } from 'axios'
import { api } from '@/lib/api'
import type { Connection, RepoSummary } from '@/types/api'

export interface ConnectionsResponse {
  connections: Connection[]
}

export interface RepoPage {
  items: RepoSummary[]
  nextPage: number | null
}

export async function getConnections(): Promise<ConnectionsResponse> {
  const { data } = await api.get<ConnectionsResponse>('/integrations')
  return data
}

export async function listRepos(params: { search?: string; page?: number }): Promise<RepoPage> {
  const { data } = await api.get<RepoPage>('/integrations/github/repos', {
    params: {
      ...(params.search ? { search: params.search } : {}),
      page: params.page ?? 1,
    },
  })
  return data
}

export async function disconnectGithub(): Promise<void> {
  await api.delete('/integrations/github')
}

// Full-page navigation — the browser must hit the server and follow its 302 to
// GitHub's consent screen, so this is a top-level nav, never an XHR.
export function connectGithub(): void {
  window.location.assign('/api/integrations/github/connect')
}

// A 428 from the repos endpoint means "GitHub not connected" — surface the
// connect prompt instead of retrying.
export function isNotConnected(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 428
}

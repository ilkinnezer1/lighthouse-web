import { AxiosError } from 'axios'
import { api } from '@/lib/api'
import type {
  CreateGitCredentialInput,
  GitCredentialView,
  IntegrationsOverview,
  RepoSummary,
} from '@/types/api'

export interface RepoPage {
  items: RepoSummary[]
  nextPage: number | null
}

export async function getIntegrations(): Promise<IntegrationsOverview> {
  const { data } = await api.get<IntegrationsOverview>('/integrations')
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

export async function disconnectAtlassian(): Promise<void> {
  await api.delete('/integrations/atlassian')
}

export async function createGitCredential(
  input: CreateGitCredentialInput,
): Promise<GitCredentialView> {
  const { data } = await api.post<GitCredentialView>('/integrations/git-credentials', input)
  return data
}

export async function deleteGitCredential(id: string): Promise<void> {
  await api.delete(`/integrations/git-credentials/${id}`)
}

// Full-page navigation — the browser must hit the server and follow its 302 to
// the provider's consent screen, so these are top-level navs, never XHRs.
export function connectGithub(): void {
  window.location.assign('/api/integrations/github/connect')
}

export function connectAtlassian(): void {
  window.location.assign('/api/integrations/atlassian/connect')
}

// A 428 from the repos endpoint means "GitHub not connected" — surface the
// connect prompt instead of retrying.
export function isNotConnected(error: unknown): boolean {
  return error instanceof AxiosError && error.response?.status === 428
}

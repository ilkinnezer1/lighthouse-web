import { describe, expect, it } from 'vitest'
import {
  environmentBranch,
  environmentTicket,
  environmentTicketHref,
  sourceBranch,
} from './environments.board'
import { awake } from '@/test/fixtures'
import type { EnvironmentListItem } from '@/types/api'

function env(over: Partial<EnvironmentListItem> = {}): EnvironmentListItem {
  return {
    id: 'e1',
    name: 'production',
    type: 'PRODUCTION',
    branch: 'main',
    subdomain: 'prod',
    customDomain: null,
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    url: 'http://prod.example.localhost',
    project: {
      id: 'p1',
      name: 'acme',
      subdomain: 'acme',
      owner: { username: 'john-doe' },
      organization: { slug: 'john-doe', atlassianSiteUrl: 'https://acme.atlassian.net' },
    },
    latestDeployment: null,
    lock: null,
    hibernation: awake,
    openFindingCount: 0,
    checklist: null,
    ...over,
  }
}

function deployment(
  branches: {
    role: 'SOURCE' | 'MERGE'
    name: string
    issueKey?: string | null
    issueTitle?: string | null
  }[],
) {
  return {
    id: 'd1',
    status: 'SUCCEEDED' as const,
    createdAt: '2026-08-02T00:00:00.000Z',
    finishedAt: '2026-08-02T00:01:00.000Z',
    commitSha: 'abcdef1234',
    commitMessage: 'do the thing',
    errorSummary: null,
    branches: branches.map((b) => ({
      role: b.role,
      name: b.name,
      issueKey: b.issueKey ?? null,
      issueTitle: b.issueTitle ?? null,
    })),
  }
}

describe('sourceBranch', () => {
  it('picks the source, not a branch merged on top of it', () => {
    const e = env({
      latestDeployment: deployment([
        { role: 'SOURCE', name: 'main' },
        { role: 'MERGE', name: 'feature/PROJ-9-thing', issueKey: 'PROJ-9', issueTitle: 'Thing' },
      ]),
    })
    expect(sourceBranch(e)?.name).toBe('main')
  })

  it('is null before the first deploy', () => {
    expect(sourceBranch(env())).toBeNull()
  })
})

describe('environmentTicket', () => {
  it('reads the ticket the deployed branch names', () => {
    const e = env({
      latestDeployment: deployment([
        {
          role: 'SOURCE',
          name: 'feature/PROJ-12-add-login',
          issueKey: 'PROJ-12',
          issueTitle: 'Add login',
        },
      ]),
    })
    expect(environmentTicket(e)).toBe('PROJ-12: Add login')
  })

  it('is null when the deployed branch names no ticket', () => {
    const e = env({ latestDeployment: deployment([{ role: 'SOURCE', name: 'main' }]) })
    expect(environmentTicket(e)).toBeNull()
  })

  it('is null before the first deploy', () => {
    expect(environmentTicket(env())).toBeNull()
  })
})

describe('environmentBranch', () => {
  it('shows what the last deploy actually ran', () => {
    const e = env({
      branch: 'main',
      latestDeployment: deployment([{ role: 'SOURCE', name: 'release/2.0' }]),
    })
    expect(environmentBranch(e)).toBe('release/2.0')
  })

  // A never-deployed environment still tells you what it is wired to track.
  it('falls back to the configured branch before the first deploy', () => {
    expect(environmentBranch(env({ branch: 'trunk' }))).toBe('trunk')
  })

  it('falls back to a dash when the environment tracks no branch', () => {
    expect(environmentBranch(env({ branch: null }))).toBe('—')
  })
})

describe('environmentTicketHref', () => {
  it('links to the ticket on the org site', () => {
    const e = env({
      latestDeployment: deployment([
        { role: 'SOURCE', name: 'feature/PROJ-12-x', issueKey: 'PROJ-12', issueTitle: 'X' },
      ]),
    })
    expect(environmentTicketHref(e)).toBe('https://acme.atlassian.net/browse/PROJ-12')
  })

  it('is null when the org has chosen no Jira site', () => {
    const e = env({
      project: { ...env().project, organization: { slug: 'john-doe', atlassianSiteUrl: null } },
      latestDeployment: deployment([
        { role: 'SOURCE', name: 'feature/PROJ-12-x', issueKey: 'PROJ-12', issueTitle: 'X' },
      ]),
    })
    expect(environmentTicketHref(e)).toBeNull()
  })

  it('is null when there is no ticket to link to', () => {
    const e = env({ latestDeployment: deployment([{ role: 'SOURCE', name: 'main' }]) })
    expect(environmentTicketHref(e)).toBeNull()
  })
})

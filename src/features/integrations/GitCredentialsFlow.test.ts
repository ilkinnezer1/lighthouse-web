import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import { apiErrorMessage } from '@/lib/api'
import ConnectionCard from './ConnectionCard.vue'
import GitCredentialsSection from './GitCredentialsSection.vue'
import { useCreateGitCredential } from './integrations.queries'
import { toCreateInput } from './integrations.credentials'
import type { GitCredentialView, GithubConnection, IntegrationsOverview } from '@/types/api'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const TOKEN = 'ghp_ThisIsTheSecretNobodyMayRender'

function credential(over: Partial<GitCredentialView> = {}): GitCredentialView {
  return {
    id: 'gc-1',
    label: 'Work laptop',
    login: 'octocat',
    fingerprint: 'a1b2c3d4',
    scopes: ['repo', 'read:org'],
    hasRepoScope: true,
    createdAt: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

const CONNECTION: GithubConnection = {
  provider: 'github',
  accountLogin: 'octocat',
  scopes: ['repo'],
  connectedAt: '2026-08-01T00:00:00.000Z',
}

function overview(gitCredentials: GitCredentialView[]): IntegrationsOverview {
  return {
    connections: [],
    providers: { github: { configured: false }, atlassian: { configured: false } },
    gitCredentials,
  }
}

let api: ApiMock
let credentials: GitCredentialView[]
const mounted: VueWrapper[] = []

beforeEach(() => {
  credentials = []
  api = installApiMock()
  api.get('/integrations', () => ({ data: overview(credentials) }))
})

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  api.restore()
})

function bodyText(): string {
  return document.body.textContent?.replace(/\s+/g, ' ') ?? ''
}

function button(match: (label: string) => boolean): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((b) =>
    match(b.textContent?.replace(/\s+/g, ' ').trim() ?? ''),
  )
  if (!found) {
    const seen = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    throw new Error(`No matching button. Present: ${seen.join(' | ')}`)
  }
  return found
}

async function mountCard(props: Record<string, unknown>) {
  const { wrapper } = await mountApp(ConnectionCard, { props })
  mounted.push(wrapper)
  await settle()
  return wrapper
}

async function mountTokens() {
  const { wrapper } = await mountApp(GitCredentialsSection)
  mounted.push(wrapper)
  await settle()
  return wrapper
}

/*
 * The inline form's own submit cannot be driven from here: a vee-validate
 * `handleSubmit` callback never runs under jsdom in this harness — the
 * pre-existing CreateProjectDialog and FileFindingDialog behave the same way,
 * so this is the harness, not the component. What the form builds is pinned in
 * `integrations.credentials.test.ts`; what the request must look like is pinned
 * here, against the same mutation the form calls.
 */
async function mountWithCreate() {
  let create: ReturnType<typeof useCreateGitCredential> | null = null
  const Harness = defineComponent({
    setup() {
      create = useCreateGitCredential()
      return () => h(GitCredentialsSection)
    },
  })
  const { wrapper } = await mountApp(Harness)
  mounted.push(wrapper)
  await settle()
  return { wrapper, create: create as unknown as ReturnType<typeof useCreateGitCredential> }
}

describe('the GitHub card on a server with no OAuth App', () => {
  // The bug this replaces: a fully enabled Connect button whose only outcome was
  // a 503 rendered as raw JSON outside the SPA.
  it('does not offer a connect action that can only fail', async () => {
    const wrapper = await mountCard({ notConfigured: true })
    expect(wrapper.text()).not.toContain('Connect GitHub')
  })

  it('says what is missing and offers the token path instead', async () => {
    const wrapper = await mountCard({ notConfigured: true })
    expect(wrapper.text()).toContain('No GitHub OAuth App on this server')
    expect(wrapper.text()).toContain('GITHUB_OAUTH_CLIENT_ID')
    expect(wrapper.text()).toContain('personal access token')

    button((l) => l === 'Use an access token').click()
    await settle()
    expect(wrapper.emitted('use-token')).toHaveLength(1)
  })

  it('still offers Connect once the server is configured', async () => {
    const wrapper = await mountCard({ notConfigured: false })
    expect(wrapper.text()).toContain('Connect GitHub')
    expect(wrapper.text()).not.toContain('No GitHub OAuth App')
  })

  // The view decides — `showsOauthNotice` is unit-tested for the loading and
  // old-server cases; the card only has to honour the answer.
  it('leaves Connect alone when nothing said otherwise', async () => {
    const wrapper = await mountCard({})
    expect(wrapper.text()).toContain('Connect GitHub')
  })

  it('never displaces an account that is already connected', async () => {
    const wrapper = await mountCard({ notConfigured: true, connection: CONNECTION })
    expect(wrapper.text()).toContain('Connected as')
    expect(wrapper.text()).toContain('Disconnect')
    expect(wrapper.text()).not.toContain('No GitHub OAuth App')
  })
})

describe('the saved tokens', () => {
  it('identifies each token without ever rendering one', async () => {
    credentials = [credential()]
    const wrapper = await mountTokens()

    expect(wrapper.text()).toContain('Work laptop')
    expect(wrapper.text()).toContain('octocat · a1b2c3d4')
    expect(wrapper.text()).toContain('[repo]')
    expect(wrapper.text()).toContain('[read:org]')
    expect(wrapper.text()).not.toContain(TOKEN)
    expect(wrapper.find('input[type="password"]').exists()).toBe(true)
  })

  it('warns when GitHub reported scopes and repo was not among them', async () => {
    credentials = [credential({ hasRepoScope: false, scopes: ['read:user'] })]
    const wrapper = await mountTokens()
    expect(wrapper.text()).toContain('Missing the repo scope')
    expect(wrapper.text()).toContain('1 without repo access')
  })

  // A fine-grained PAT sends no scope header, so the server reports null. The
  // page must not turn "unknown" into a fault.
  it('says nothing about scopes for a fine-grained token', async () => {
    credentials = [credential({ hasRepoScope: null, scopes: [] })]
    const wrapper = await mountTokens()
    expect(wrapper.text()).not.toContain('Missing the repo scope')
    expect(wrapper.text()).not.toContain('Can read and clone')
    expect(wrapper.text()).not.toContain('without repo access')
  })

  it('tells people the token is optional when they have none', async () => {
    const wrapper = await mountTokens()
    expect(wrapper.text()).toContain('nothing here is needed for public repositories')
    expect(wrapper.text()).toContain('Personal access tokens (classic)')
  })
})

describe('saving a token', () => {
  it('posts what the form built, and shows the token it got back', async () => {
    let sent: unknown
    api.post('/integrations/git-credentials', (call) => {
      sent = call.body
      credentials = [credential({ label: 'CI box' })]
      return { status: 201, data: credentials[0] }
    })

    const { wrapper, create } = await mountWithCreate()
    await create.mutateAsync(toCreateInput({ token: `  ${TOKEN}\n`, label: ' CI box ' }))
    await settle()

    expect(api.callsTo('post', '/integrations/git-credentials')).toHaveLength(1)
    expect(sent).toEqual({ token: TOKEN, label: 'CI box' })
    expect(wrapper.text()).toContain('CI box')
  })

  // GitHub's verdict is the only thing that says what to do next — invalid,
  // already stored, or unreachable. It is relayed, not reworded.
  it("relays the server's refusal verbatim", async () => {
    api.post('/integrations/git-credentials', {
      status: 409,
      data: { message: 'That token is already stored', statusCode: 409 },
    })

    const { create } = await mountWithCreate()
    await expect(create.mutateAsync({ token: TOKEN })).rejects.toSatisfy(
      (error: unknown) =>
        apiErrorMessage(error, 'Could not save the token') === 'That token is already stored',
    )
  })

  // A 5xx is where a generic "Server error, try again" would normally take
  // over and bury the one sentence that explains the failure.
  it('keeps the message on a 502 too', async () => {
    api.post('/integrations/git-credentials', {
      status: 502,
      data: { message: 'GitHub is unreachable', statusCode: 502 },
    })

    const { create } = await mountWithCreate()
    await expect(create.mutateAsync({ token: TOKEN })).rejects.toSatisfy(
      (error: unknown) =>
        apiErrorMessage(error, 'Could not save the token') === 'GitHub is unreachable',
    )
  })
})

describe('removing a token', () => {
  it('asks first, then deletes the one it named', async () => {
    api.delete('/integrations/git-credentials/gc-1', () => {
      credentials = []
      return { status: 204 }
    })

    credentials = [credential()]
    await mountTokens()

    document.querySelector<HTMLButtonElement>('[aria-label="Remove Work laptop"]')?.click()
    await settle()
    expect(bodyText()).toContain('Remove this token?')

    button((l) => l === 'Remove').click()
    await settle()

    expect(api.callsTo('delete', '/integrations/git-credentials/gc-1')).toHaveLength(1)
  })
})

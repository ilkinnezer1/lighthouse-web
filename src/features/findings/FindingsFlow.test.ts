import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import type { VueWrapper } from '@vue/test-utils'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import { makeDeployment } from '@/test/fixtures'
import DeploymentFindings from './DeploymentFindings.vue'
import { useCreateFinding } from './findings.queries'
import { createFindingSchema } from './findings.schemas'
import type { Finding, Organization } from '@/types/api'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const ORG: Organization = {
  id: 'org-1',
  name: 'Acme',
  slug: 'acme',
  isPersonal: true,
  createdAt: '2026-08-01T00:00:00.000Z',
  role: 'MEMBER',
}

const FINDINGS_URL = '/deployments/dep-1/findings'

function finding(over: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    title: 'Coupon breaks the checkout total',
    body: null,
    status: 'OPEN',
    createdAt: '2026-08-20T11:00:00.000Z',
    updatedAt: '2026-08-20T11:00:00.000Z',
    reportedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'a@example.com' },
    resolvedBy: null,
    resolvedAt: null,
    foundOn: {
      id: 'dep-1',
      status: 'SUCCEEDED',
      commitSha: 'abcdef1234567890',
      commitMessage: 'Add the thing',
      createdAt: '2026-08-20T10:00:00.000Z',
    },
    fixedIn: null,
    logSnapshotStatus: 'CAPTURED',
    ...over,
  }
}

let api: ApiMock
let list: Finding[]

beforeEach(() => {
  api = installApiMock()
  list = []
  api.get('/orgs', { data: [ORG] })
  api.get(FINDINGS_URL, () => ({ data: list }))
  api.get(/\/findings\/f1$/, { data: { ...finding(), logSnapshot: 'boom' } })
})

afterEach(() => {
  api.restore()
})

async function mountSection(route = '/deployments/dep-1') {
  const mounted = await mountApp(DeploymentFindings, {
    props: { deployment: makeDeployment() },
    initialRoute: route,
  })
  await settle()
  return mounted.wrapper
}

// The dialog teleports to body, so its controls are queried off the document.
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

async function click(match: (label: string) => boolean) {
  button(match).click()
  await settle()
}

async function openDialog(wrapper: VueWrapper) {
  await click((l) => l === 'Report a finding')
  return wrapper
}

/*
 * The dialog's own submit cannot be driven from here: a vee-validate form
 * inside a teleported dialog never reaches its handler under jsdom — the
 * pre-existing CreateProjectDialog behaves the same way, so this is the
 * harness, not the component. The dialog is verified in a real browser; what
 * the request must look like is pinned here instead, against the same
 * mutation the dialog calls.
 */
function mountWithCreate() {
  let create: ReturnType<typeof useCreateFinding> | null = null
  const Harness = defineComponent({
    setup() {
      create = useCreateFinding('dep-1')
      return () => h(DeploymentFindings, { deployment: makeDeployment() })
    },
  })
  return mountApp(Harness, { initialRoute: '/deployments/dep-1' }).then(async (mounted) => {
    await settle()
    return { ...mounted, create: create as unknown as ReturnType<typeof useCreateFinding> }
  })
}

describe('the zero case', () => {
  it('is one line, not a panel — most builds have no findings', async () => {
    const wrapper = await mountSection()
    expect(wrapper.text()).toContain('Nothing reported on this build')
    expect(wrapper.find('[class*="py-16"]').exists()).toBe(false)
  })
})

describe('filing a finding', () => {
  it('shows what will be attached, so nobody pastes the sha in by hand', async () => {
    const wrapper = await mountSection()
    await openDialog(wrapper)

    const text = document.body.textContent?.replace(/\s+/g, ' ') ?? ''
    expect(text).toContain('Attached automatically')
    expect(text).toContain('abcdef1')
    expect(text).toContain('staging')
  })

  it('sends only what QA typed — the build comes from the URL', async () => {
    api.post(FINDINGS_URL, (call) => {
      const body = call.body as { title: string }
      const created = finding({ title: body.title })
      list = [created]
      return { data: created }
    })

    const { wrapper, create } = await mountWithCreate()
    expect(wrapper.text()).toContain('Nothing reported on this build')

    await create.mutateAsync({ title: 'Coupon breaks the checkout total' })
    await settle()

    const posted = api.callsTo('post', FINDINGS_URL)
    expect(posted).toHaveLength(1)
    expect(posted[0]?.body).toEqual({ title: 'Coupon breaks the checkout total' })
    // The list came back on its own: filing has to leave the section correct
    // without the page being reloaded.
    expect(wrapper.text()).toContain('Coupon breaks the checkout total')
  })

  it('sends the optional detail when there is one, and nothing else', async () => {
    api.post(FINDINGS_URL, (call) => ({ data: finding((call.body as Partial<Finding>) ?? {}) }))

    const { create } = await mountWithCreate()
    await create.mutateAsync({ title: 'Coupon breaks the total', body: 'Apply SAVE10 twice.' })
    await settle()

    expect(api.callsTo('post', FINDINGS_URL)[0]?.body).toEqual({
      title: 'Coupon breaks the total',
      body: 'Apply SAVE10 twice.',
    })
  })
})

// The form's own rules, mirroring the server's bounds rather than inventing
// stricter ones — a finding titled "404" is a real finding.
describe('what the form will accept', () => {
  it('requires a title', () => {
    expect(createFindingSchema.safeParse({ title: '' }).success).toBe(false)
  })

  it('takes a short one', () => {
    expect(createFindingSchema.safeParse({ title: '404' }).success).toBe(true)
  })

  it('stops at the length the API stops at', () => {
    expect(createFindingSchema.safeParse({ title: 'x'.repeat(200) }).success).toBe(true)
    expect(createFindingSchema.safeParse({ title: 'x'.repeat(201) }).success).toBe(false)
  })

  it('treats the body as optional', () => {
    expect(createFindingSchema.safeParse({ title: 'Broken' }).success).toBe(true)
    expect(createFindingSchema.safeParse({ title: 'Broken', body: '' }).success).toBe(true)
  })
})

describe('a finding on the build in front of you', () => {
  beforeEach(() => {
    list = [finding()]
  })

  // Staleness is an environment-page question. Here every finding is on this
  // build by construction, and saying "found on abcdef1" under a page that is
  // already abcdef1 is noise.
  it('says nothing about staleness', async () => {
    const wrapper = await mountSection()
    expect(wrapper.text()).toContain('Coupon breaks the checkout total')
    expect(wrapper.text()).not.toContain('Found on')
  })

  it('marks it fixed without asking which build fixed it', async () => {
    api.patch('/findings/f1', (call) => {
      const fixed = finding({
        ...(call.body as Partial<Finding>),
        fixedIn: finding().foundOn,
        resolvedBy: { id: 'u2', username: 'ada', displayName: 'Ada', email: 'ada@example.com' },
        resolvedAt: '2026-08-20T12:00:00.000Z',
      })
      list = [fixed]
      return { data: fixed }
    })

    const wrapper = await mountSection()
    await click((l) => l.includes('Coupon breaks the checkout total'))
    await click((l) => l === 'Mark fixed')

    const patched = api.callsTo('patch', '/findings/f1')
    expect(patched).toHaveLength(1)
    // No build id in the body: which build fixed it is the server's to know.
    expect(patched[0]?.body).toEqual({ status: 'FIXED' })
    expect(wrapper.text()).toContain('Fixed by Ada')
  })

  // An inbox notification names one finding; landing on the page with it still
  // collapsed makes the reader hunt for the thing they were just told about.
  it('opens the one finding a notification pointed at', async () => {
    const wrapper = await mountSection('/deployments/dep-1?finding=f1')
    expect(api.callsTo('get', /\/findings\/f1$/)).toHaveLength(1)
    expect(wrapper.text()).toContain('Logs at the time')
  })

  it('leaves the rest collapsed when the link names another finding', async () => {
    const wrapper = await mountSection('/deployments/dep-1?finding=f9')
    expect(wrapper.text()).not.toContain('Logs at the time')
  })

  it('fetches the log snapshot only once the finding is opened', async () => {
    const wrapper = await mountSection()
    expect(api.callsTo('get', /\/findings\/f1$/)).toHaveLength(0)

    await click((l) => l.includes('Coupon breaks the checkout total'))
    expect(api.callsTo('get', /\/findings\/f1$/)).toHaveLength(1)
    expect(wrapper.text()).toContain('boom')
  })
})

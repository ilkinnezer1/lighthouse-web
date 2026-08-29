import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import { makeDeployment } from '@/test/fixtures'
import DeploymentChecklist from './DeploymentChecklist.vue'
import { useCheckItem } from './checklist.queries'
import { summarize } from './checklist.progress'
import type { Checklist, ChecklistCheck, ChecklistItem, Organization } from '@/types/api'

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

const CHECKLIST_URL = '/deployments/dep-1/checklist'
const CHECK_URL = '/deployments/dep-1/checklist/items/it-1/check'
const FINDINGS_URL = '/deployments/dep-1/findings'

const THIS_BUILD = {
  id: 'dep-1',
  status: 'SUCCEEDED' as const,
  commitSha: 'def5678000000',
  commitMessage: 'Add the thing',
  createdAt: '2026-08-20T12:00:00.000Z',
}
const EARLIER_BUILD = { ...THIS_BUILD, id: 'dep-0', commitSha: 'abc1234000000' }

function check(over: Partial<ChecklistCheck> = {}): ChecklistCheck {
  return {
    id: 'chk-1',
    result: 'PASS',
    note: null,
    findingId: null,
    checkedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'a@example.com' },
    createdAt: '2026-08-20T13:00:00.000Z',
    build: THIS_BUILD,
    ...over,
  }
}

function item(over: Partial<ChecklistItem> = {}): ChecklistItem {
  return {
    id: 'it-1',
    title: 'Coupon SAVE10 applies once',
    source: 'SEEDED',
    issueKey: 'PROJ-12',
    issueUrl: 'https://acme.atlassian.net/browse/PROJ-12',
    createdBy: null,
    createdAt: '2026-08-20T09:00:00.000Z',
    check: null,
    lastCheck: null,
    ...over,
  }
}

function view(items: ChecklistItem[], seedable = 0): Checklist {
  return { deployment: THIS_BUILD, items, summary: summarize(items), seedable }
}

let api: ApiMock
let checklist: Checklist

beforeEach(() => {
  api = installApiMock()
  checklist = view([])
  api.get('/orgs', { data: [ORG] })
  api.get(CHECKLIST_URL, () => ({ data: checklist }))
})

afterEach(() => {
  api.restore()
})

async function mountSection() {
  const mounted = await mountApp(DeploymentChecklist, {
    props: { deployment: makeDeployment() },
    initialRoute: '/deployments/dep-1',
  })
  await settle()
  return mounted.wrapper
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

async function click(match: (label: string) => boolean) {
  button(match).click()
  await settle()
}

/*
 * The dialog's own submit cannot be driven from here: a vee-validate form
 * inside a teleported dialog never reaches its handler under jsdom, which
 * FindingsFlow already documents. What the request must look like is pinned
 * against the same mutation the dialog's `submit` prop calls.
 */
function mountWithCheck() {
  let mutation: ReturnType<typeof useCheckItem> | null = null
  const Harness = defineComponent({
    setup() {
      mutation = useCheckItem('dep-1')
      return () => h(DeploymentChecklist, { deployment: makeDeployment() })
    },
  })
  return mountApp(Harness, { initialRoute: '/deployments/dep-1' }).then(async (mounted) => {
    await settle()
    return { ...mounted, check: mutation as unknown as ReturnType<typeof useCheckItem> }
  })
}

describe('the zero case', () => {
  it('says the list belongs to the environment, not to this build', async () => {
    const wrapper = await mountSection()
    expect(wrapper.text()).toContain('Nothing to test on this environment yet')
  })

  it('offers no seed button when a seed would add nothing', async () => {
    await mountSection()
    expect(() => button((l) => l.startsWith('Add') && l.includes('from this build'))).toThrow()
  })
})

describe('seeding', () => {
  beforeEach(() => {
    checklist = view([], 3)
  })

  // The count is a promise about what the click does — an "Add items" that adds
  // an unknown number is a button nobody presses twice.
  it('promises the exact number of rows the click adds', async () => {
    const wrapper = await mountSection()
    expect(wrapper.text()).toContain('Add 3 from this build')
  })

  it('seeds through its own POST, never as a side effect of the read', async () => {
    api.post(`${CHECKLIST_URL}/seed`, () => {
      checklist = view([item(), item({ id: 'it-2', issueKey: 'PROJ-13' })])
      return { data: checklist }
    })

    const wrapper = await mountSection()
    await click((l) => l === 'Add 3 from this build')

    expect(api.callsTo('post', `${CHECKLIST_URL}/seed`)).toHaveLength(1)
    // The seed answers with the whole list, so the section is correct without
    // a second round trip.
    expect(api.callsTo('get', CHECKLIST_URL)).toHaveLength(1)
    expect(wrapper.text()).toContain('0 of 2 checked')
  })
})

describe('ticking an item', () => {
  beforeEach(() => {
    checklist = view([item()])
  })

  it('records a pass against the build being viewed', async () => {
    api.put(CHECK_URL, () => ({ data: item({ check: check() }) }))

    const wrapper = await mountSection()
    expect(wrapper.text()).toContain('0 of 1 checked')

    await click((l) => l === 'Pass')

    const put = api.callsTo('put', CHECK_URL)
    expect(put).toHaveLength(1)
    // No build id in the body: which build is being ticked is in the URL.
    expect(put[0]?.body).toEqual({ result: 'PASS' })
    expect(wrapper.text()).toContain('Checked')
    expect(wrapper.text()).toContain('Passed by Aysel')
  })

  it('undoes a check without touching the item itself', async () => {
    checklist = view([item({ check: check() })])
    api.delete(CHECK_URL, () => ({ data: item() }))

    const wrapper = await mountSection()
    document.querySelector<HTMLButtonElement>('button[title="Undo this check"]')?.click()
    await settle()

    // The item survives; only the claim about this build is withdrawn.
    expect(api.callsTo('delete', CHECK_URL)).toHaveLength(1)
    expect(api.callsTo('delete', '/checklist-items/it-1')).toHaveLength(0)
    expect(wrapper.text()).toContain('0 of 1 checked')
  })
})

describe('failing an item', () => {
  beforeEach(() => {
    checklist = view([item()])
  })

  it('opens the finding dialog with the item already in the title', async () => {
    await mountSection()
    await click((l) => l === 'Fail')

    const text = document.body.textContent?.replace(/\s+/g, ' ') ?? ''
    expect(text).toContain('Fail this check')
    const title = [...document.querySelectorAll('input')].find(
      (i) => i.value === 'Coupon SAVE10 applies once',
    )
    expect(title).toBeTruthy()
    // Failing without writing the bug up is a real state, so the dialog keeps
    // a way through it.
    expect(text).toContain('Fail without a report')
  })

  /*
   * The whole point of the `finding` field: one call records the fail and files
   * the bug, so a half-written pair can never exist. Filing separately would
   * also double the inbox notification.
   */
  it('files the bug through the check route, not through the findings route', async () => {
    api.put(CHECK_URL, () => ({
      data: item({ check: check({ result: 'FAIL', findingId: 'f1' }) }),
    }))
    api.get(FINDINGS_URL, { data: [] })

    const { check: mutation } = await mountWithCheck()
    await mutation.mutateAsync({
      itemId: 'it-1',
      result: 'FAIL',
      finding: { title: 'Coupon SAVE10 applies once', body: 'Apply it twice.' },
    })
    await settle()

    expect(api.callsTo('put', CHECK_URL)[0]?.body).toEqual({
      result: 'FAIL',
      finding: { title: 'Coupon SAVE10 applies once', body: 'Apply it twice.' },
    })
    expect(api.callsTo('post', FINDINGS_URL)).toHaveLength(0)
  })

  /*
   * "Tried it, broken, no time to write it up" is a real state. Demanding a bug
   * report is how a checklist stops being used — and a fail is tested and
   * broken either way, so it never stays counted as outstanding work.
   */
  it('records a bare fail when nobody writes the bug up', async () => {
    api.put(CHECK_URL, () => {
      checklist = view([item({ check: check({ result: 'FAIL' }) })])
      return { data: checklist.items[0] }
    })

    const wrapper = await mountSection()
    await click((l) => l === 'Fail')
    await click((l) => l === 'Fail without a report')

    expect(api.callsTo('put', CHECK_URL)[0]?.body).toEqual({ result: 'FAIL' })
    expect(wrapper.text()).not.toContain('0 of 1 checked')
    expect(wrapper.text()).toContain('1 failed')
  })
})

describe('a tick made on an earlier build', () => {
  it('says which build it was made on, and which one this is', async () => {
    checklist = view([item({ lastCheck: check({ build: EARLIER_BUILD }) })])

    const wrapper = await mountSection()
    const text = wrapper.text().replace(/\s+/g, ' ')

    expect(text).toContain('Checked on abc1234 — this build is def5678')
    // And it is outstanding again: the claim was about the other build.
    expect(text).toContain('0 of 1 checked')
  })
})

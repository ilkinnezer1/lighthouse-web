import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import type { Deployment, MaintenanceActionDef } from '@/types/api'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle, type MountAppOptions } from '@/test/mount'
import { lastSocket } from '@/test/socket.mock'
import { makeBranch, makeDeployment, makeService, makeStage, project } from '@/test/fixtures'
import { Skeleton } from '@/components/ui/skeleton'
import DeploymentDetailView from './DeploymentDetailView.vue'
import { deploymentKeys } from './deployments.queries'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

interface FakeStream {
  response: Response
  push: (text: string) => void
  close: () => void
}

function makeStream(status = 200): FakeStream {
  let ctrl!: ReadableStreamDefaultController<Uint8Array>
  let closed = false
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      ctrl = c
    },
  })
  return {
    response: { ok: status >= 200 && status < 300, status, body } as unknown as Response,
    push: (text) => ctrl.enqueue(new TextEncoder().encode(text)),
    close: () => {
      if (!closed) {
        closed = true
        ctrl.close()
      }
    },
  }
}

const HEALTHY = { service: 'web', state: 'running', health: 'none', restartCount: 0, exitCode: 0 }

let api: ApiMock
let fetchRoutes: { match: RegExp; respond: () => Response }[]
let openStreams: FakeStream[]

function onFetch(match: RegExp, respond: () => Response) {
  fetchRoutes.unshift({ match, respond })
}

function openStream(status = 200): FakeStream {
  const stream = makeStream(status)
  openStreams.push(stream)
  return stream
}

beforeEach(() => {
  api = installApiMock()
  api.get('/projects/proj-1', { data: project })
  api.get(/\/branches/, { data: [] })
  api.get(/\/health$/, { data: HEALTHY })
  api.get(/\/stats$/, { status: 404, data: {} })

  fetchRoutes = []
  openStreams = []
  onFetch(/runtime-logs/, () => openStream().response)

  vi.stubGlobal(
    'fetch',
    vi.fn((input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      const route = fetchRoutes.find((r) => r.match.test(url))
      if (!route) return Promise.reject(new Error(`No fetch route for ${url}`))
      return Promise.resolve(route.respond())
    }),
  )
})

afterEach(() => {
  for (const s of openStreams) s.close()
  api.restore()
})

interface MountOpts {
  id?: string
  deployment?: Deployment | null
  actions?: MaintenanceActionDef[]
  stubs?: MountAppOptions['stubs']
}

/*
 * ServiceHealthBadge and this view's `liveTone` map re-trigger each other
 * without converging once two services render — pinned in
 * ServiceHealthBadge.test.ts. Tests that are not about health stub it out so
 * that defect cannot drown their assertions.
 */
const STUB_HEALTH_BADGE = { ServiceHealthBadge: { template: '<span><slot /></span>' } }

function routeDeployment(id: string, deployment: Deployment | null) {
  api.get(`/deployments/${id}`, { data: deployment })
}

async function mountDetail(opts: MountOpts = {}) {
  const id = opts.id ?? 'dep-1'
  routeDeployment(id, opts.deployment === undefined ? makeDeployment() : opts.deployment)
  api.get(`/deployments/${id}/actions`, { data: { actions: opts.actions ?? [] } })
  const mounted = await mountApp(DeploymentDetailView, {
    props: { id },
    initialRoute: `/deployments/${id}`,
    stubs: opts.stubs,
  })
  await settle()
  return mounted
}

function buttons(wrapper: VueWrapper) {
  return wrapper.findAll('button')
}

function findButton(wrapper: VueWrapper, label: string) {
  return buttons(wrapper).find((b) => b.text().includes(label))
}

function button(wrapper: VueWrapper, label: string) {
  const found = findButton(wrapper, label)
  if (!found) {
    const labels = buttons(wrapper).map((b) => JSON.stringify(b.text()))
    throw new Error(`No button matching "${label}". Present: ${labels.join(', ')}`)
  }
  return found
}

describe('DeploymentDetailView — loading and failure', () => {
  it('shows skeletons and no content while the deployment is still loading', async () => {
    routeDeployment('dep-1', makeDeployment())
    api.get('/deployments/dep-1/actions', { data: { actions: [] } })
    const { wrapper } = await mountApp(DeploymentDetailView, {
      props: { id: 'dep-1' },
      initialRoute: '/deployments/dep-1',
    })

    expect(wrapper.findAllComponents(Skeleton).length).toBe(3)
    expect(wrapper.text()).not.toContain('Add the thing')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('surfaces the API error message rather than a generic failure', async () => {
    api.get('/deployments/dep-1', { status: 500, data: { message: 'Worker is unreachable' } })
    api.get('/deployments/dep-1/actions', { data: { actions: [] } })
    const { wrapper } = await mountApp(DeploymentDetailView, {
      props: { id: 'dep-1' },
      initialRoute: '/deployments/dep-1',
    })
    await settle()

    expect(wrapper.find('[role="alert"]').text()).toContain('Worker is unreachable')
  })

  it('falls back to "Deployment not found." when the body carries no message', async () => {
    const { wrapper } = await mountDetail({ deployment: null })
    expect(wrapper.find('[role="alert"]').text()).toContain('Deployment not found.')
  })

  it('recovers when Try again succeeds after a failure', async () => {
    api.get('/deployments/dep-1', { status: 500, data: {} })
    api.get('/deployments/dep-1/actions', { data: { actions: [] } })
    const { wrapper } = await mountApp(DeploymentDetailView, {
      props: { id: 'dep-1' },
      initialRoute: '/deployments/dep-1',
    })
    await settle()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)

    routeDeployment('dep-1', makeDeployment())
    await button(wrapper, 'Try again').trigger('click')
    await settle()

    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Add the thing')
  })
})

describe('DeploymentDetailView — header and status-driven actions', () => {
  it('renders the error summary banner only when the deployment carries one', async () => {
    const clean = await mountDetail()
    expect(clean.wrapper.text()).not.toContain('exit status 1')

    const failed = await mountDetail({
      id: 'dep-2',
      deployment: makeDeployment({
        id: 'dep-2',
        status: 'FAILED',
        errorSummary: 'build stage: exit status 1',
      }),
    })
    expect(failed.wrapper.text()).toContain('build stage: exit status 1')
  })

  it('offers Cancel but not Redeploy or Rollback while a deploy is in flight', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'BUILDING', finishedAt: null }),
    })

    expect(findButton(wrapper, 'Cancel')).toBeDefined()
    expect(findButton(wrapper, 'Redeploy')).toBeUndefined()
    expect(findButton(wrapper, 'Rollback')).toBeUndefined()
  })

  it('offers Redeploy and Rollback once a deploy has succeeded', async () => {
    const { wrapper } = await mountDetail()

    expect(findButton(wrapper, 'Cancel')).toBeUndefined()
    expect(findButton(wrapper, 'Redeploy')).toBeDefined()
    expect(findButton(wrapper, 'Rollback')).toBeDefined()
  })

  it('offers Redeploy but not Rollback on a failed deploy', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'FAILED', errorSummary: null }),
    })

    expect(findButton(wrapper, 'Redeploy')).toBeDefined()
    expect(findButton(wrapper, 'Rollback')).toBeUndefined()
  })

  it('shows the build duration only once the deploy has finished', async () => {
    const done = await mountDetail()
    expect(done.wrapper.text()).toContain('built in 1m 30s')

    const running = await mountDetail({
      id: 'dep-3',
      deployment: makeDeployment({ id: 'dep-3', status: 'BUILDING', finishedAt: null }),
    })
    expect(running.wrapper.text()).not.toContain('built in')
  })

  it('replaces the Open link with "Not running" when the live web container is down', async () => {
    api.get(/\/health$/, { data: { ...HEALTHY, state: 'exited', exitCode: 137 } })
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'SUCCEEDED',
        services: [makeService({ status: 'exited' })],
      }),
    })
    await settle()

    expect(wrapper.text()).toContain('Not running')
    expect(wrapper.find('a[href="https://staging-acme.example.test"]').exists()).toBe(false)
  })

  it('links to the live URL when the web container is healthy', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ services: [makeService()] }),
    })
    await settle()

    expect(wrapper.find('a[href="https://staging-acme.example.test"]').exists()).toBe(true)
    expect(wrapper.text()).not.toContain('Not running')
  })

  it('carries the deployment status in the tab title and restores it on unmount', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'BUILDING', finishedAt: null }),
    })

    expect(document.title).toBe('• Building — Acme/staging')

    wrapper.unmount()
    expect(document.title).toBe('Lighthouse')
  })
})

describe('DeploymentDetailView — stages', () => {
  it('relabels a stage left PENDING on a finished deploy as Skipped and dims it', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'FAILED',
        stages: [
          makeStage({ id: 's1', name: 'clone', status: 'SUCCEEDED' }),
          makeStage({ id: 's2', name: 'build', status: 'FAILED' }),
          makeStage({
            id: 's3',
            name: 'push',
            status: 'PENDING',
            startedAt: null,
            finishedAt: null,
          }),
        ],
      }),
    })

    const rows = wrapper.findAll('ol li')
    expect(rows[2].text()).toContain('Skipped')
    expect(rows[2].text()).not.toContain('Pending')
    expect(rows[2].classes()).toContain('opacity-55')
    expect(rows[1].classes()).not.toContain('opacity-55')
  })

  it('keeps a PENDING stage labelled Pending while the deploy is still running', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'BUILDING',
        finishedAt: null,
        stages: [
          makeStage({ id: 's1', name: 'build', status: 'RUNNING', finishedAt: null }),
          makeStage({
            id: 's2',
            name: 'push',
            status: 'PENDING',
            startedAt: null,
            finishedAt: null,
          }),
        ],
      }),
    })

    const rows = wrapper.findAll('ol li')
    expect(rows[1].text()).toContain('Pending')
    expect(rows[1].classes()).not.toContain('opacity-55')
  })

  it('hides the stages section entirely when the deployment has none', async () => {
    const { wrapper } = await mountDetail({ deployment: makeDeployment({ stages: [] }) })
    expect(wrapper.text()).not.toContain('Stages')
  })

  it('re-evaluates Pending into Skipped when the deploy reaches a terminal status', async () => {
    const stages = [
      makeStage({ id: 's1', name: 'build', status: 'RUNNING', finishedAt: null }),
      makeStage({ id: 's2', name: 'push', status: 'PENDING', startedAt: null, finishedAt: null }),
    ]
    const { wrapper, queryClient } = await mountDetail({
      deployment: makeDeployment({ status: 'BUILDING', finishedAt: null, stages }),
    })
    expect(wrapper.findAll('ol li')[1].text()).toContain('Pending')

    queryClient.setQueryData(
      deploymentKeys.detail('dep-1'),
      makeDeployment({ status: 'CANCELLED', stages }),
    )
    await settle()

    expect(wrapper.findAll('ol li')[1].text()).toContain('Skipped')
  })
})

describe('DeploymentDetailView — branches', () => {
  it('hides the branches section when the deployment records no branch set', async () => {
    const { wrapper } = await mountDetail({ deployment: makeDeployment({ branches: [] }) })
    expect(wrapper.text()).not.toContain('Branches')
  })

  it('marks the source branch and every merged branch', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        branches: [
          makeBranch({ id: 'b1', role: 'SOURCE', name: 'main' }),
          makeBranch({ id: 'b2', role: 'MERGE', name: 'feature/x', sha: 'fedcba9876543210' }),
        ],
      }),
    })
    await settle()

    const text = wrapper.text()
    expect(text).toContain('Branches')
    expect(text).toContain('main')
    expect(text).toContain('source')
    expect(text).toContain('feature/x')
    expect(text).toContain('merged')
  })

  it('shows "actual" for a merge branch with no commits ahead of the source', async () => {
    api.get(/\/branches/, {
      data: [
        { name: 'main', sha: 'abcdef1', aheadBy: 0, behindBy: 0, lastCommitDate: null },
        { name: 'feature/x', sha: 'fedcba9', aheadBy: 0, behindBy: 0, lastCommitDate: null },
      ],
    })
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        branches: [
          makeBranch({ id: 'b1', role: 'SOURCE', name: 'main' }),
          makeBranch({ id: 'b2', role: 'MERGE', name: 'feature/x' }),
        ],
      }),
    })
    await settle()

    expect(wrapper.text()).toContain('actual')
    expect(wrapper.text()).not.toContain('ahead')
  })

  it('shows the ahead count for a merge branch that has moved on', async () => {
    api.get(/\/branches/, {
      data: [{ name: 'feature/x', sha: 'fedcba9', aheadBy: 3, behindBy: 0, lastCommitDate: null }],
    })
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        branches: [
          makeBranch({ id: 'b1', role: 'SOURCE', name: 'main' }),
          makeBranch({ id: 'b2', role: 'MERGE', name: 'feature/x' }),
        ],
      }),
    })
    await settle()

    expect(wrapper.text()).toContain('3 ahead')
    expect(wrapper.text()).not.toContain('actual')
  })
})

describe('DeploymentDetailView — build log pane', () => {
  it('subscribes to the deployment over the socket', async () => {
    await mountDetail()
    expect(lastSocket().emitted).toContainEqual({
      event: 'subscribe',
      payload: { deploymentId: 'dep-1' },
    })
  })

  it('appends lines pushed over the socket', async () => {
    const { wrapper } = await mountDetail()
    lastSocket().serverEmit('log', { id: 'l1', line: 'npm install', stage: 'build' } as never)
    lastSocket().serverEmit('log', { id: 'l2', line: 'done', stage: null } as never)
    await settle()

    expect(wrapper.text()).toContain('npm install')
    expect(wrapper.text()).toContain('[build]')
    expect(wrapper.text()).toContain('done')
  })

  it('refetches the deployment when a deployment.* event arrives', async () => {
    await mountDetail()
    const before = api.callsTo('get', '/deployments/dep-1').length

    lastSocket().serverEmit('deployment.status_changed')
    await settle()

    expect(api.callsTo('get', '/deployments/dep-1').length).toBeGreaterThan(before)
  })

  it('ignores a plain log event for the refetch trigger', async () => {
    await mountDetail()
    const before = api.callsTo('get', '/deployments/dep-1').length

    lastSocket().serverEmit('log', { id: 'l1', line: 'x', stage: null } as never)
    await settle()

    expect(api.callsTo('get', '/deployments/dep-1').length).toBe(before)
  })

  it('reports the stream as offline once the socket disconnects', async () => {
    const { wrapper } = await mountDetail()
    expect(wrapper.text()).toContain('live')

    lastSocket().serverEmit('disconnect')
    await settle()

    expect(wrapper.text()).toContain('offline')
  })

  it('says "Waiting for logs…" on an in-flight deploy with no output yet', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'BUILDING', finishedAt: null }),
    })
    expect(wrapper.text()).toContain('Waiting for logs…')
  })

  it('says "No logs for this deployment." on a finished deploy with no output', async () => {
    const { wrapper } = await mountDetail()
    expect(wrapper.text()).toContain('No logs for this deployment.')
  })

  it('filters lines and reports how many the filter hid', async () => {
    const { wrapper } = await mountDetail()
    lastSocket().serverEmit('log', { id: 'l1', line: 'npm install', stage: 'build' } as never)
    lastSocket().serverEmit('log', { id: 'l2', line: 'compiling', stage: 'build' } as never)
    lastSocket().serverEmit('log', { id: 'l3', line: 'npm warn', stage: 'build' } as never)
    await settle()

    await wrapper.find('input[aria-label="Filter log lines"]').setValue('npm')
    await settle()

    expect(wrapper.text()).toContain('npm install')
    expect(wrapper.text()).not.toContain('compiling')
    expect(wrapper.text()).toContain('1 line hidden by the filter.')
  })

  it('pluralises the hidden-line count', async () => {
    const { wrapper } = await mountDetail()
    for (const [i, line] of ['a', 'b', 'c'].entries()) {
      lastSocket().serverEmit('log', { id: `l${i}`, line, stage: null } as never)
    }
    await settle()

    await wrapper.find('input[aria-label="Filter log lines"]').setValue('a')
    await settle()

    expect(wrapper.text()).toContain('2 lines hidden by the filter.')
  })

  it('explains when the filter matches nothing rather than showing a blank pane', async () => {
    const { wrapper } = await mountDetail()
    lastSocket().serverEmit('log', { id: 'l1', line: 'npm install', stage: null } as never)
    await settle()

    await wrapper.find('input[aria-label="Filter log lines"]').setValue('zzz')
    await settle()

    expect(wrapper.text()).toContain('No line matches “zzz”.')
    expect(wrapper.text()).toContain('1 line hidden by the filter.')
  })

  it('matches the stage name as well as the line body', async () => {
    const { wrapper } = await mountDetail()
    lastSocket().serverEmit('log', { id: 'l1', line: 'aaa', stage: 'clone' } as never)
    lastSocket().serverEmit('log', { id: 'l2', line: 'bbb', stage: 'build' } as never)
    await settle()

    await wrapper.find('input[aria-label="Filter log lines"]').setValue('clone')
    await settle()

    expect(wrapper.text()).toContain('aaa')
    expect(wrapper.text()).not.toContain('bbb')
  })

  it('disables the download button until there is something to download', async () => {
    const { wrapper } = await mountDetail()
    expect(wrapper.find('button[aria-label="Download logs"]').attributes('disabled')).toBeDefined()

    lastSocket().serverEmit('log', { id: 'l1', line: 'x', stage: null } as never)
    await settle()

    expect(
      wrapper.find('button[aria-label="Download logs"]').attributes('disabled'),
    ).toBeUndefined()
  })
})

describe('DeploymentDetailView — runtime log tab', () => {
  it('disables the runtime tab while the deployment cannot serve logs', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'FAILED', errorSummary: null }),
    })
    expect(button(wrapper, 'Runtime logs').attributes('disabled')).toBeDefined()
  })

  it('enables the runtime tab on a running deployment', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'RUNNING', finishedAt: null }),
    })
    expect(button(wrapper, 'Runtime logs').attributes('disabled')).toBeUndefined()
  })

  it('says it is waiting for output once the runtime tab is open', async () => {
    const { wrapper } = await mountDetail()
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    expect(wrapper.text()).toContain('Waiting for output…')
  })

  it('explains the runtime tab went unavailable when the status leaves RUNNING', async () => {
    const { wrapper, queryClient } = await mountDetail({
      deployment: makeDeployment({ status: 'RUNNING', finishedAt: null }),
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    queryClient.setQueryData(deploymentKeys.detail('dep-1'), makeDeployment({ status: 'FAILED' }))
    await settle()

    expect(wrapper.text()).toContain('Runtime logs are available while the deployment is running.')
  })

  it('streams runtime output into the pane', async () => {
    const stream = openStream()
    onFetch(/runtime-logs/, () => stream.response)
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'RUNNING', finishedAt: null }),
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    stream.push('listening on :3000\n')
    await settle()

    expect(wrapper.text()).toContain('listening on :3000')
  })

  it('keeps the build and runtime panes separate when switching tabs', async () => {
    const stream = openStream()
    onFetch(/runtime-logs/, () => stream.response)
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({ status: 'RUNNING', finishedAt: null }),
    })
    lastSocket().serverEmit('log', { id: 'l1', line: 'BUILD LINE', stage: null } as never)
    await settle()

    await button(wrapper, 'Runtime logs').trigger('click')
    stream.push('RUNTIME LINE\n')
    await settle()

    expect(wrapper.text()).toContain('RUNTIME LINE')
    expect(wrapper.text()).not.toContain('BUILD LINE')

    await button(wrapper, 'Build logs').trigger('click')
    await settle()

    expect(wrapper.text()).toContain('BUILD LINE')
    expect(wrapper.text()).not.toContain('RUNTIME LINE')
  })
})

describe('DeploymentDetailView — service selection', () => {
  it('preselects the web service even when it is not first in the list', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [
          makeService({ id: 's1', name: 'worker', isWeb: false }),
          makeService({ id: 's2', name: 'api', isWeb: true }),
        ],
      }),
      stubs: STUB_HEALTH_BADGE,
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    const pills = wrapper.findAll('.overflow-x-auto button')
    const selected = pills.find((p) => p.classes().includes('text-primary'))
    expect(selected?.text()).toContain('api')
  })

  it('falls back to the first service when none is marked web', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [
          makeService({ id: 's1', name: 'worker', isWeb: false }),
          makeService({ id: 's2', name: 'cron', isWeb: false }),
        ],
      }),
      stubs: STUB_HEALTH_BADGE,
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    const pills = wrapper.findAll('.overflow-x-auto button')
    const selected = pills.find((p) => p.classes().includes('text-primary'))
    expect(selected?.text()).toContain('worker')
  })

  it('hides the service switcher for a single-service deployment', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [makeService()],
      }),
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    expect(wrapper.findAll('.overflow-x-auto button').length).toBe(0)
  })

  it('hides the service switcher on the build tab even with several services', async () => {
    const { wrapper } = await mountDetail({
      deployment: makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [
          makeService({ id: 's1', name: 'web' }),
          makeService({ id: 's2', name: 'worker', isWeb: false }),
        ],
      }),
      stubs: STUB_HEALTH_BADGE,
    })

    expect(wrapper.findAll('.overflow-x-auto button').length).toBe(0)
  })

  it('reselects when the previously selected service disappears from the payload', async () => {
    const { wrapper, queryClient } = await mountDetail({
      deployment: makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [
          makeService({ id: 's1', name: 'worker', isWeb: false }),
          makeService({ id: 's2', name: 'api', isWeb: true }),
        ],
      }),
      stubs: STUB_HEALTH_BADGE,
    })
    await button(wrapper, 'Runtime logs').trigger('click')
    await settle()

    queryClient.setQueryData(
      deploymentKeys.detail('dep-1'),
      makeDeployment({
        status: 'RUNNING',
        finishedAt: null,
        services: [makeService({ id: 's3', name: 'renamed', isWeb: true })],
      }),
    )
    await settle()

    expect(wrapper.text()).toContain('renamed')
  })
})

describe('DeploymentDetailView — maintenance actions', () => {
  const migrate: MaintenanceActionDef = {
    id: 'migrate',
    label: 'Run migrations',
    service: 'web',
    destructive: false,
  }
  const wipe: MaintenanceActionDef = {
    id: 'wipe',
    label: 'Wipe database',
    service: 'db',
    destructive: true,
  }

  it('hides the maintenance section when the project defines no actions', async () => {
    const { wrapper } = await mountDetail({ actions: [] })
    expect(wrapper.text()).not.toContain('Maintenance')
  })

  it('lists every configured action', async () => {
    const { wrapper } = await mountDetail({ actions: [migrate, wipe] })
    expect(wrapper.text()).toContain('Maintenance')
    expect(findButton(wrapper, 'Run migrations')).toBeDefined()
    expect(findButton(wrapper, 'Wipe database')).toBeDefined()
  })

  it('does not run a destructive action straight from its button', async () => {
    const { wrapper } = await mountDetail({ actions: [wipe] })
    await button(wrapper, 'Wipe database').trigger('click')
    await settle()

    const fetchMock = globalThis.fetch as ReturnType<typeof vi.fn>
    const actionCalls = fetchMock.mock.calls.filter((c) => String(c[0]).includes('/actions/'))
    expect(actionCalls).toHaveLength(0)
  })

  it('streams output and reports the exit code of a successful run', async () => {
    const stream = openStream()
    onFetch(/\/actions\//, () => stream.response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()
    expect(wrapper.text()).toContain('Running…')

    stream.push('Migrating: 2026_08_01_create_users\n')
    await settle()
    expect(wrapper.text()).toContain('Migrating: 2026_08_01_create_users')

    stream.push('\x1e{"exitCode":0}\n')
    stream.close()
    await settle()

    expect(wrapper.text()).toContain('exit 0')
  })

  it('reports a non-zero exit code as a failure', async () => {
    const stream = openStream()
    onFetch(/\/actions\//, () => stream.response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()
    stream.push('boom\n\x1e{"exitCode":1}\n')
    stream.close()
    await settle()

    expect(wrapper.text()).toContain('exit 1')
    expect(wrapper.text()).toContain('boom')
  })

  it('does not claim success when the stream ends without an exit frame', async () => {
    const stream = openStream()
    onFetch(/\/actions\//, () => stream.response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()
    stream.push('partial output\n')
    stream.close()
    await settle()

    expect(wrapper.text()).toContain('Stream ended before the command reported an exit code.')
  })

  it('reports an HTTP failure instead of hanging on "Running…"', async () => {
    onFetch(/\/actions\//, () => ({ ok: false, status: 502, body: null }) as unknown as Response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()

    expect(wrapper.text()).toContain('Could not start the action (502).')
  })

  it('clears a finished run from the pane when dismissed', async () => {
    const stream = openStream()
    onFetch(/\/actions\//, () => stream.response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()
    stream.push('output\n\x1e{"exitCode":0}\n')
    stream.close()
    await settle()
    expect(wrapper.text()).toContain('exit 0')

    await wrapper.find('button[title="Clear"]').trigger('click')
    await settle()

    expect(wrapper.text()).not.toContain('exit 0')
    expect(wrapper.text()).not.toContain('output')
  })

  /*
   * The /deployments/:id route reuses this component instance on a param change.
   * Without the reset watch the previous deployment's maintenance output would
   * still be on screen, attributed to the new deployment.
   */
  it('drops the previous deployment run when the route id changes', async () => {
    const stream = openStream()
    onFetch(/\/actions\//, () => stream.response)
    const { wrapper } = await mountDetail({ actions: [migrate] })

    await button(wrapper, 'Run migrations').trigger('click')
    await settle()
    stream.push('previous deployment output\n\x1e{"exitCode":0}\n')
    stream.close()
    await settle()
    expect(wrapper.text()).toContain('previous deployment output')

    routeDeployment('dep-9', makeDeployment({ id: 'dep-9', commitMessage: 'Second deploy' }))
    api.get('/deployments/dep-9/actions', { data: { actions: [migrate] } })
    await wrapper.setProps({ id: 'dep-9' })
    await settle()

    expect(wrapper.text()).toContain('Second deploy')
    expect(wrapper.text()).not.toContain('previous deployment output')
    expect(wrapper.text()).not.toContain('exit 0')
  })

  it('restarts the build log stream for the new deployment on a route id change', async () => {
    const { wrapper } = await mountDetail()
    lastSocket().serverEmit('log', { id: 'l1', line: 'OLD BUILD LINE', stage: null } as never)
    await settle()
    expect(wrapper.text()).toContain('OLD BUILD LINE')

    routeDeployment('dep-9', makeDeployment({ id: 'dep-9' }))
    api.get('/deployments/dep-9/actions', { data: { actions: [] } })
    await wrapper.setProps({ id: 'dep-9' })
    await settle()

    expect(wrapper.text()).not.toContain('OLD BUILD LINE')
    expect(lastSocket().emitted).toContainEqual({
      event: 'subscribe',
      payload: { deploymentId: 'dep-9' },
    })
  })
})

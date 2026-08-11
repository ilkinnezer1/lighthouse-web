import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import ServiceHealthBadge from './ServiceHealthBadge.vue'
import type { HealthTone } from './serviceHealth'

let api: ApiMock

beforeEach(() => {
  api = installApiMock()
})

afterEach(() => {
  api.restore()
})

function routeHealth(state: string, health: string, extra: Record<string, unknown> = {}) {
  api.get(/\/health$/, {
    data: { service: 'web', state, health, restartCount: 0, exitCode: 0, ...extra },
  })
}

async function mountBadge(props: Record<string, unknown> = {}) {
  return mountApp(ServiceHealthBadge, {
    props: {
      deploymentId: 'dep-1',
      service: 'web',
      isWeb: true,
      dbStatus: 'running',
      hasContainer: true,
      port: 3000,
      ...props,
    },
  })
}

describe('ServiceHealthBadge — live state over DB state', () => {
  it('falls back to the DB status until live health arrives', async () => {
    api.get(/\/health$/, { status: 404, data: {} })
    const { wrapper } = await mountBadge({ hasContainer: false, dbStatus: 'running' })

    expect(wrapper.text()).toContain('running')
    expect(wrapper.emitted('tone')?.[0]).toEqual(['ok'])
  })

  it('reports a non-running DB status as down before live health arrives', async () => {
    api.get(/\/health$/, { status: 404, data: {} })
    const { wrapper } = await mountBadge({ hasContainer: false, dbStatus: 'exited' })

    expect(wrapper.emitted('tone')?.[0]).toEqual(['down'])
  })

  it('shows an em dash when there is no DB status at all', async () => {
    api.get(/\/health$/, { status: 404, data: {} })
    const { wrapper } = await mountBadge({ hasContainer: false, dbStatus: null, isWeb: false })

    expect(wrapper.text()).toContain('—')
  })

  it('overrides a stale "running" DB status once live health says exited', async () => {
    routeHealth('exited', 'none', { exitCode: 137 })
    const { wrapper } = await mountBadge({ dbStatus: 'running', isWeb: false })
    await settle()

    expect(wrapper.text()).toContain('exited (137)')
    expect(wrapper.emitted('tone')?.at(-1)).toEqual(['down'])
  })

  it('treats an unhealthy healthcheck on a running container as down', async () => {
    routeHealth('running', 'unhealthy')
    const { wrapper } = await mountBadge({ isWeb: false })
    await settle()

    expect(wrapper.text()).toContain('unhealthy')
    expect(wrapper.emitted('tone')?.at(-1)).toEqual(['down'])
  })

  it('replaces the label with "Not running" for a downed web service', async () => {
    routeHealth('exited', 'none', { exitCode: 137 })
    const { wrapper } = await mountBadge({ isWeb: true })
    await settle()

    expect(wrapper.text()).toContain('Not running')
    expect(wrapper.text()).not.toContain('exited (137)')
  })

  it('treats a starting healthcheck as a warning, not a failure', async () => {
    routeHealth('running', 'starting')
    const { wrapper } = await mountBadge()
    await settle()

    expect(wrapper.text()).toContain('starting')
    expect(wrapper.emitted('tone')?.at(-1)).toEqual(['warn'])
  })

  it('surfaces a restart count when the container has been restarting', async () => {
    routeHealth('running', 'none', { restartCount: 4 })
    const { wrapper } = await mountBadge()
    await settle()

    expect(wrapper.text()).toContain('restarts: 4')
  })

  it('shows the "Not running" warning only for a web service that is down', async () => {
    routeHealth('exited', 'none', { exitCode: 1 })
    const web = await mountBadge({ isWeb: true })
    await settle()
    expect(web.wrapper.text()).toContain('Not running')

    const worker = await mountBadge({ isWeb: false })
    await settle()
    expect(worker.wrapper.text()).not.toContain('Not running')
  })
})

/*
 * The badge reports its tone through a pre-flush watchEffect, and
 * DeploymentDetailView records it with `liveTone = { ...liveTone, [name]: tone }`
 * — a fresh object on every emit, so the write never settles. With one service
 * it emits twice and stops; from two services up the emits never stop.
 * Pinned as a known defect, not as desired behaviour.
 */
describe('ServiceHealthBadge — tone reporting loop (known defect)', () => {
  // The write budget stops the runaway short of Vue's recursive-update guard,
  // which would otherwise throw out of the scheduler and fail the run.
  const WRITE_BUDGET = 30

  async function countEmits(names: string[]) {
    api.get(/\/health$/, { status: 404, data: {} })
    const onTone = vi.fn()

    const Harness = defineComponent({
      setup() {
        const liveTone = ref<Record<string, HealthTone>>({})
        let writes = 0
        return () =>
          h(
            'div',
            names.map((name) =>
              h(ServiceHealthBadge, {
                key: name,
                deploymentId: 'dep-1',
                service: name,
                isWeb: name === 'web',
                dbStatus: 'running',
                hasContainer: false,
                port: null,
                onTone: (tone: HealthTone) => {
                  onTone(name, tone)
                  if (writes++ < WRITE_BUDGET) {
                    liveTone.value = { ...liveTone.value, [name]: tone }
                  }
                },
              }),
            ),
          )
      },
    })

    const { wrapper } = await mountApp(Harness)
    await settle(6)
    wrapper.unmount()
    return onTone.mock.calls.length
  }

  it('settles after one emit per badge when a single service is rendered', async () => {
    expect(await countEmits(['web'])).toBeLessThanOrEqual(2)
  })

  it('re-emits without converging once two services are rendered', async () => {
    expect(await countEmits(['web', 'worker'])).toBeGreaterThan(WRITE_BUDGET)
  })
})

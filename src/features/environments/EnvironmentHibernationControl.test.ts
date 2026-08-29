import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mountApp, settle } from '@/test/mount'
import EnvironmentHibernationControl from './EnvironmentHibernationControl.vue'
import { wakeEnvironment } from './environments.api'
import type { EnvironmentHibernation } from '@/types/api'

const NOW = '2026-08-20T12:00:00.000Z'

vi.mock('./environments.api', () => ({
  updateHibernation: vi.fn(),
  wakeEnvironment: vi.fn(),
  hibernateEnvironment: vi.fn(),
}))

// Role gating denies while the orgs query is loading, which would hide every
// action this file is about.
vi.mock('@/features/orgs/useCan', () => ({ useCan: () => ({ value: true }) }))

function hibernation(over: Partial<EnvironmentHibernation> = {}): EnvironmentHibernation {
  return {
    enabled: false,
    idleTimeoutMinutes: 240,
    sleeping: false,
    hibernatedAt: null,
    lastActivityAt: null,
    ...over,
  }
}

const mounted: VueWrapper[] = []

async function mountControl(h: EnvironmentHibernation) {
  const { wrapper } = await mountApp(EnvironmentHibernationControl, {
    props: { envId: 'env-1', projectId: 'proj-1', hibernation: h },
  })
  mounted.push(wrapper)
  await settle()
  return wrapper
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(NOW))
})

afterEach(() => {
  while (mounted.length) mounted.pop()?.unmount()
  vi.useRealTimers()
})

describe('EnvironmentHibernationControl', () => {
  // The requirement the whole feature turns on: a sleeping environment's URL
  // 404s, and a bare 404 reads as "this environment does not exist".
  it('says the URL needs a wake, next to the way to wake it', async () => {
    const wrapper = await mountControl(
      hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
    )
    expect(wrapper.text()).toContain('Asleep · 3h')
    expect(wrapper.text()).toContain('Sleeping — wake it to use the URL')
    expect(wrapper.text()).toContain('Wake')
  })

  it('wakes the environment it was given', async () => {
    vi.mocked(wakeEnvironment).mockResolvedValue({
      hibernation: hibernation({ enabled: true, lastActivityAt: NOW }),
      services: [{ name: 'web', state: 'running' }],
    })

    const wrapper = await mountControl(
      hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
    )
    const wake = wrapper.findAll('button').find((b) => b.text().includes('Wake'))
    await wake?.trigger('click')
    await settle()

    expect(wakeEnvironment).toHaveBeenCalledWith('env-1')
  })

  // An awake environment's URL works, so nothing may suggest otherwise.
  it('carries no URL warning while the environment is awake', async () => {
    const wrapper = await mountControl(
      hibernation({ enabled: true, lastActivityAt: '2026-08-20T11:40:00.000Z' }),
    )
    expect(wrapper.text()).toContain('Sleeps in 3h 40m')
    expect(wrapper.text()).not.toContain('wake it to use the URL')
    expect(wrapper.text()).not.toContain('Wake')
  })

  it('offers the settings when hibernation is off', async () => {
    const wrapper = await mountControl(hibernation())
    expect(wrapper.text()).toContain('Hibernation off')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mountApp } from '@/test/mount'
import EnvironmentSleepBadge from './EnvironmentSleepBadge.vue'
import type { EnvironmentHibernation } from '@/types/api'

const NOW = '2026-08-20T12:00:00.000Z'

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

// The shared clock is a module singleton that stops when its last subscriber
// goes away, so every mount here has to be torn down.
const mounted: VueWrapper[] = []

async function mountBadge(props: Record<string, unknown>) {
  const { wrapper } = await mountApp(EnvironmentSleepBadge, { props })
  mounted.push(wrapper)
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

describe('EnvironmentSleepBadge', () => {
  it('says how long the environment has been asleep', async () => {
    const wrapper = await mountBadge({
      hibernation: hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
    })
    expect(wrapper.text()).toContain('Asleep · 3h')
  })

  it('renders nothing while the environment is awake', async () => {
    const awake = await mountBadge({ hibernation: hibernation() })
    expect(awake.text()).toBe('')

    // Armed but not asleep is still awake: the board must not warn about a URL
    // that works.
    const armed = await mountBadge({
      hibernation: hibernation({ enabled: true, lastActivityAt: '2026-08-20T11:40:00.000Z' }),
    })
    expect(armed.text()).toBe('')
  })

  it('tolerates the field being absent entirely', async () => {
    const wrapper = await mountBadge({ hibernation: undefined })
    expect(wrapper.text()).toBe('')
  })

  // A bare 404 is indistinguishable from a deleted environment, so the reason
  // has to be within reach of the badge itself.
  it('explains the dead URL in the tooltip', async () => {
    const wrapper = await mountBadge({
      hibernation: hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
    })
    const title = wrapper.find('span[title]').attributes('title') ?? ''
    expect(title).toContain('404')
    expect(title).toContain('woken')
  })

  // The board's own column is too narrow for the word.
  it('shows only the duration in its compact form', async () => {
    const { wrapper } = await mountApp(EnvironmentSleepBadge, {
      props: {
        hibernation: hibernation({ sleeping: true, hibernatedAt: '2026-08-20T09:00:00.000Z' }),
        compact: true,
      },
    })
    mounted.push(wrapper)
    expect(wrapper.text()).toBe('3h')
    // The sentence is still one hover away.
    expect(wrapper.find('span[title]').attributes('title')).toContain('404')
  })

  // On a board left open, the duration has to keep counting without a refetch.
  it('ages on the shared clock, with no refetch', async () => {
    const wrapper = await mountBadge({
      hibernation: hibernation({ sleeping: true, hibernatedAt: '2026-08-20T11:58:00.000Z' }),
    })
    expect(wrapper.text()).toContain('2m')

    await vi.advanceTimersByTimeAsync(10 * 60_000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('12m')
  })
})

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { VueWrapper } from '@vue/test-utils'
import { mountApp } from '@/test/mount'
import EnvironmentLockBadge from './EnvironmentLockBadge.vue'
import type { EnvironmentLock } from '@/types/api'

const NOW = '2026-08-20T12:00:00.000Z'

function lock(over: Partial<EnvironmentLock> = {}): EnvironmentLock {
  return {
    lockedBy: { id: 'u1', username: 'aysel', displayName: 'Aysel', email: 'aysel@example.com' },
    lockedAt: '2026-08-20T11:26:00.000Z',
    expiresAt: '2026-08-20T12:34:00.000Z',
    reason: 'Regression pass on checkout',
    ...over,
  }
}

// The shared clock is a module singleton that stops when its last subscriber
// goes away. Every mount here has to be torn down, or the next test inherits a
// timer handle belonging to a fake-timer context that no longer exists — and
// then nothing ticks.
const mounted: VueWrapper[] = []

async function mountBadge(props: Record<string, unknown>) {
  const { wrapper } = await mountApp(EnvironmentLockBadge, { props })
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

describe('EnvironmentLockBadge', () => {
  it('names the holder and the time left', async () => {
    const wrapper = await mountBadge({ lock: lock(), currentUserId: 'u2' })
    expect(wrapper.text()).toContain('Aysel · 34m left')
  })

  // Your own lock is a different message: you are not asking who to go find.
  it('says "You" when the lock is your own', async () => {
    const wrapper = await mountBadge({ lock: lock(), currentUserId: 'u1' })
    expect(wrapper.text()).toContain('You · 34m left')
  })

  it('renders nothing when there is no lock', async () => {
    const wrapper = await mountBadge({ lock: null, currentUserId: 'u1' })
    expect(wrapper.text()).toBe('')
  })

  // The whole reason liveness is computed rather than trusted: a cached row can
  // still carry a lock whose time is up, and it must read as unlocked.
  it('renders nothing for a lock that has already expired', async () => {
    const wrapper = await mountBadge({
      lock: lock({ expiresAt: '2026-08-20T11:00:00.000Z' }),
      currentUserId: 'u2',
    })
    expect(wrapper.text()).toBe('')
  })

  // The API will not send the key at all until the lock endpoints ship.
  it('tolerates the field being absent entirely', async () => {
    const wrapper = await mountBadge({ lock: undefined, currentUserId: 'u1' })
    expect(wrapper.text()).toBe('')
  })

  it('puts the holder, expiry and reason in the tooltip', async () => {
    const wrapper = await mountBadge({ lock: lock(), currentUserId: 'u2' })
    const title = wrapper.find('span[title]').attributes('title') ?? ''
    expect(title).toContain('Aysel')
    expect(title).toContain('Regression pass on checkout')
  })

  // The badge must go quiet on its own, on a board nobody has touched.
  it('drops the badge as the clock crosses the expiry, with no refetch', async () => {
    const wrapper = await mountBadge({
      lock: lock({ expiresAt: '2026-08-20T12:00:45.000Z' }),
      currentUserId: 'u2',
    })
    expect(wrapper.text()).toContain('<1m left')

    await vi.advanceTimersByTimeAsync(60_000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toBe('')
  })
})

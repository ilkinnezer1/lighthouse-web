import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import FindingLogSnapshot from './FindingLogSnapshot.vue'
import type { LogSnapshotStatus } from '@/types/api'

let api: ApiMock

beforeEach(() => {
  api = installApiMock()
})

afterEach(() => {
  api.restore()
})

async function mountSnapshot(status: LogSnapshotStatus, logSnapshot: string | null = null) {
  api.get('/findings/f1', { data: { id: 'f1', logSnapshot } })
  const { wrapper } = await mountApp(FindingLogSnapshot, {
    props: { findingId: 'f1', status },
  })
  await settle()
  return wrapper
}

describe('FindingLogSnapshot', () => {
  it('shows the captured output', async () => {
    const wrapper = await mountSnapshot('CAPTURED', 'TypeError: undefined\n  at checkout.ts:14\n')
    expect(wrapper.text()).toContain('TypeError: undefined')
    expect(wrapper.text()).toContain('at checkout.ts:14')
  })

  /*
   * The distinction the whole field exists for. "Nothing was captured" is a
   * fact about Lighthouse; "the app logged nothing" is a fact about the bug,
   * and reading the first as the second sends someone hunting for a silent
   * failure that never happened.
   */
  it('reads as not captured when there was nothing to capture from', async () => {
    const wrapper = await mountSnapshot('UNAVAILABLE')
    expect(wrapper.text()).toContain('Not captured')
    expect(wrapper.text()).not.toContain('had written nothing')
  })

  it('reads as captured-but-silent when the container logged nothing', async () => {
    const wrapper = await mountSnapshot('CAPTURED', '')
    expect(wrapper.text()).toContain('had written nothing')
    expect(wrapper.text()).not.toContain('Not captured')
  })

  it('does not ask for a snapshot that was never taken', async () => {
    await mountSnapshot('UNAVAILABLE')
    expect(api.callsTo('get', '/findings/f1')).toHaveLength(0)
  })
})

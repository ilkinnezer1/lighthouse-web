import { describe, expect, it } from 'vitest'
import { mountApp } from '@/test/mount'
import FindingStaleNote from './FindingStaleNote.vue'
import type { FindingFreshness } from './findings.staleness'

async function mountNote(freshness: FindingFreshness) {
  const { wrapper } = await mountApp(FindingStaleNote, { props: { freshness } })
  return wrapper
}

// The rendered sentence has to match `stalenessNote`, which is what the title
// attribute carries — the two drifting apart is the failure this guards.
describe('FindingStaleNote', () => {
  it('names both builds when the environment has moved on', async () => {
    const wrapper = await mountNote({
      kind: 'superseded',
      foundSha: 'abc1234000',
      currentSha: 'def5678000',
    })
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain(
      'Found on abc1234 — this environment is now on def5678',
    )
  })

  it('renders the shas in mono, since that is what people compare', async () => {
    const wrapper = await mountNote({
      kind: 'superseded',
      foundSha: 'abc1234000',
      currentSha: 'def5678000',
    })
    const mono = wrapper.findAll('.font-mono').map((n) => n.text())
    expect(mono).toEqual(['abc1234', 'def5678'])
  })

  it('says nothing at all when the finding is on the build in front of you', async () => {
    const wrapper = await mountNote({ kind: 'current' })
    expect(wrapper.text()).toBe('')
  })

  it('says the commit is unchanged after a redeploy', async () => {
    const wrapper = await mountNote({ kind: 'rebuilt', foundSha: 'abc1234000' })
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain(
      'Found on abc1234 — redeployed since at the same commit',
    )
  })

  it('says when nothing is deployed on the environment now', async () => {
    const wrapper = await mountNote({ kind: 'nothing-deployed', foundSha: 'abc1234000' })
    expect(wrapper.text().replace(/\s+/g, ' ')).toContain('nothing is deployed on this environment')
  })
})

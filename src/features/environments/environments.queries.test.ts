import { describe, expect, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { mountApp } from '@/test/mount'
import { environmentBoardKeys, useApplyHibernation } from './environments.queries'
import { projectKeys } from '@/features/projects/projects.queries'
import { awake, environment, project } from '@/test/fixtures'
import type { EnvironmentHibernation, EnvironmentListItem, Project } from '@/types/api'

const asleep: EnvironmentHibernation = {
  ...awake,
  enabled: true,
  sleeping: true,
  hibernatedAt: '2026-08-20T09:00:00.000Z',
}

function boardRow(id: string, hibernation: EnvironmentHibernation): EnvironmentListItem {
  return {
    id,
    name: 'staging',
    type: 'PREVIEW',
    branch: 'main',
    subdomain: 'staging',
    customDomain: null,
    active: true,
    createdAt: '2026-08-01T00:00:00.000Z',
    url: 'http://staging.example.localhost',
    project: {
      id: 'proj-1',
      name: 'Acme',
      subdomain: 'acme',
      owner: { username: 'aysel' },
      organization: { slug: 'acme', atlassianSiteUrl: null },
    },
    latestDeployment: null,
    lock: null,
    hibernation,
    openFindingCount: 0,
    checklist: null,
  }
}

const boardKey = [...environmentBoardKeys.all, 'board', 'org-1', null, null, null]

async function withApply() {
  let apply!: ReturnType<typeof useApplyHibernation>
  const Harness = defineComponent({
    setup() {
      apply = useApplyHibernation()
      return () => h('div')
    },
  })
  const { wrapper, queryClient } = await mountApp(Harness)
  return { apply, queryClient, wrapper }
}

describe('useApplyHibernation', () => {
  // Waking is a Docker start, so the refetch behind it is slow enough that a row
  // still reading "Asleep" a second after the click reads as a failed click.
  it('writes the response into the board feed without waiting for a refetch', async () => {
    const { apply, queryClient, wrapper } = await withApply()
    queryClient.setQueryData(boardKey, {
      pages: [{ items: [boardRow('env-1', asleep), boardRow('env-2', asleep)], nextCursor: null }],
      pageParams: [''],
    })

    apply('env-1', awake, 'proj-1')

    const cached = queryClient.getQueryData<{
      pages: { items: EnvironmentListItem[] }[]
    }>(boardKey)
    expect(cached?.pages[0].items[0].hibernation.sleeping).toBe(false)
    // The other rows are untouched — a wake is about one environment.
    expect(cached?.pages[0].items[1].hibernation.sleeping).toBe(true)
    wrapper.unmount()
  })

  it('writes it into the project payload the environment page reads', async () => {
    const { apply, queryClient, wrapper } = await withApply()
    queryClient.setQueryData<Project>(projectKeys.detail('proj-1'), {
      ...project,
      environments: [
        { ...environment, id: 'env-1', hibernation: awake },
        { ...environment, id: 'env-2', hibernation: awake },
      ],
    })

    apply('env-1', asleep, 'proj-1')

    const cached = queryClient.getQueryData<Project>(projectKeys.detail('proj-1'))
    expect(cached?.environments?.[0].hibernation.sleeping).toBe(true)
    expect(cached?.environments?.[1].hibernation.sleeping).toBe(false)
    wrapper.unmount()
  })

  it('leaves caches it was not given alone', async () => {
    const { apply, queryClient, wrapper } = await withApply()
    expect(() => apply('env-1', awake, 'proj-1')).not.toThrow()
    expect(queryClient.getQueryData(boardKey)).toBeUndefined()
    wrapper.unmount()
  })
})

import { describe, expect, it } from 'vitest'
import { groupNotifications } from './inbox.group'
import type { AppNotification, NotificationContext } from '@/types/api'

let seq = 0
function n(
  kind: string,
  context: NotificationContext | null,
  over: Partial<AppNotification> = {},
): AppNotification {
  seq += 1
  return {
    id: `n${seq}`,
    kind,
    title: kind,
    body: null,
    link: `/deployments/d${seq}`,
    context,
    readAt: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    ...over,
  }
}

const env = (id: string, name: string): NotificationContext => ({
  environmentId: id,
  environmentName: name,
})

describe('groupNotifications', () => {
  it('collapses a run of the same kind on the same subject into one row', () => {
    const groups = groupNotifications([
      n('deploy.failed', env('e1', 'production')),
      n('deploy.failed', env('e1', 'production')),
      n('deploy.failed', env('e1', 'production')),
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0].items).toHaveLength(3)
    expect(groups[0].headline).toBe('3 deploys failed on production')
  })

  it('uses the single-item sentence when a run is one long', () => {
    const groups = groupNotifications([n('deploy.failed', env('e1', 'production'))])
    expect(groups[0].headline).toBe('Your deploy to production failed')
  })

  it('keeps different kinds apart even on the same subject', () => {
    const groups = groupNotifications([
      n('deploy.failed', env('e1', 'production')),
      n('deploy.succeeded', env('e1', 'production')),
    ])
    expect(groups).toHaveLength(2)
  })

  it('keeps different subjects apart even for the same kind', () => {
    const groups = groupNotifications([
      n('deploy.failed', env('e1', 'production')),
      n('deploy.failed', env('e2', 'staging')),
    ])
    expect(groups).toHaveLength(2)
  })

  // The whole reason grouping is adjacency-based rather than global.
  it('does not merge across an unrelated item, which would reorder the feed', () => {
    const groups = groupNotifications([
      n('deploy.failed', env('e1', 'production')),
      n('deploy.succeeded', env('e1', 'production')),
      n('deploy.failed', env('e1', 'production')),
    ])
    expect(groups.map((g) => g.items.length)).toEqual([1, 1, 1])
    expect(groups.map((g) => g.kind)).toEqual([
      'deploy.failed',
      'deploy.succeeded',
      'deploy.failed',
    ])
  })

  it('never merges items with no identifiable subject', () => {
    const groups = groupNotifications([n('deploy.failed', null), n('deploy.failed', null)])
    expect(groups).toHaveLength(2)
  })

  it('preserves feed order and every item', () => {
    const items = [
      n('deploy.failed', env('e1', 'production')),
      n('deploy.failed', env('e1', 'production')),
      n('deploy.cancelled', env('e2', 'staging')),
    ]
    const groups = groupNotifications(items)
    expect(groups.flatMap((g) => g.items).map((i) => i.id)).toEqual(items.map((i) => i.id))
  })

  it('is unread when any member is, and read only when all are', () => {
    const read = { readAt: '2026-08-20T12:05:00.000Z' }
    const mixed = groupNotifications([
      n('deploy.failed', env('e1', 'production'), read),
      n('deploy.failed', env('e1', 'production')),
    ])
    expect(mixed[0].unread).toBe(true)

    const allRead = groupNotifications([
      n('deploy.failed', env('e1', 'production'), read),
      n('deploy.failed', env('e1', 'production'), read),
    ])
    expect(allRead[0].unread).toBe(false)
  })

  it('carries a link for a single item but not for a burst', () => {
    const single = groupNotifications([
      n('deploy.failed', env('e1', 'production'), { link: '/deployments/abc' }),
    ])
    expect(single[0].link).toBe('/deployments/abc')

    const burst = groupNotifications([
      n('deploy.failed', env('e1', 'production')),
      n('deploy.failed', env('e1', 'production')),
    ])
    expect(burst[0].link).toBeNull()
  })

  it('identifies and dates a group by its newest member', () => {
    const newest = n('deploy.failed', env('e1', 'production'), {
      id: 'newest',
      createdAt: '2026-08-20T12:10:00.000Z',
    })
    const older = n('deploy.failed', env('e1', 'production'), {
      id: 'older',
      createdAt: '2026-08-20T12:00:00.000Z',
    })
    const [group] = groupNotifications([newest, older])
    expect(group.id).toBe('newest')
    expect(group.createdAt).toBe('2026-08-20T12:10:00.000Z')
  })

  it('returns nothing for an empty feed', () => {
    expect(groupNotifications([])).toEqual([])
  })
})

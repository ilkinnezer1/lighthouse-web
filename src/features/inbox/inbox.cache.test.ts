import { describe, expect, it } from 'vitest'
import {
  applyRead,
  applyReadAll,
  feedItems,
  feedUnreadCount,
  receiveNotification,
  type InboxFeed,
} from './inbox.cache'
import type { AppNotification } from '@/types/api'

const READ_AT = '2026-08-20T12:30:00.000Z'

function n(id: string, over: Partial<AppNotification> = {}): AppNotification {
  return {
    id,
    kind: 'deploy.failed',
    title: 'Deployment failed',
    body: null,
    link: `/deployments/${id}`,
    context: null,
    readAt: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    ...over,
  }
}

function feed(pages: { items: AppNotification[]; unreadCount?: number }[]): InboxFeed {
  return {
    pages: pages.map((p, i) => ({
      items: p.items,
      nextCursor: i === pages.length - 1 ? null : `c${i}`,
      unreadCount: p.unreadCount ?? 0,
    })),
    pageParams: pages.map((_, i) => (i === 0 ? '' : `c${i - 1}`)),
  }
}

describe('feedUnreadCount', () => {
  it('reads page 0 and ignores the stale copies on later pages', () => {
    expect(
      feedUnreadCount(
        feed([
          { items: [], unreadCount: 3 },
          { items: [], unreadCount: 99 },
        ]),
      ),
    ).toBe(3)
  })

  it('is zero for an unfetched feed', () => {
    expect(feedUnreadCount(undefined)).toBe(0)
    expect(feedItems(undefined)).toEqual([])
  })
})

describe('receiveNotification', () => {
  it('prepends a new arrival to the first page and takes the server count', () => {
    const next = receiveNotification(feed([{ items: [n('a')], unreadCount: 1 }]), n('b'), 2)
    expect(feedItems(next).map((i) => i.id)).toEqual(['b', 'a'])
    expect(feedUnreadCount(next)).toBe(2)
  })

  // The push and a refetch can both deliver the same row.
  it('replaces in place instead of duplicating an id it already holds', () => {
    const before = feed([{ items: [n('a'), n('b')], unreadCount: 2 }])
    const next = receiveNotification(before, n('a', { title: 'Updated' }), 1)
    expect(feedItems(next).map((i) => i.id)).toEqual(['a', 'b'])
    expect(feedItems(next)[0].title).toBe('Updated')
    expect(feedUnreadCount(next)).toBe(1)
  })

  it('dedupes against a later page too, not just the first', () => {
    const before = feed([{ items: [n('a')] }, { items: [n('z')] }])
    const next = receiveNotification(before, n('z', { title: 'Updated' }), 1)
    expect(feedItems(next).map((i) => i.id)).toEqual(['a', 'z'])
    expect(feedItems(next)[1].title).toBe('Updated')
  })

  // Writing a page here would strand it with no cursor to page from.
  it('leaves an unfetched feed alone', () => {
    expect(receiveNotification(undefined, n('a'), 1)).toBeUndefined()
    const empty: InboxFeed = { pages: [], pageParams: [] }
    expect(receiveNotification(empty, n('a'), 1)).toBe(empty)
  })

  it('does not mutate the feed it was given', () => {
    const before = feed([{ items: [n('a')], unreadCount: 1 }])
    receiveNotification(before, n('b'), 2)
    expect(before.pages[0].items.map((i) => i.id)).toEqual(['a'])
    expect(before.pages[0].unreadCount).toBe(1)
  })

  it('keeps the paging cursors intact', () => {
    const before = feed([{ items: [n('a')] }, { items: [n('b')] }])
    const next = receiveNotification(before, n('c'), 1)
    expect(next?.pages.map((p) => p.nextCursor)).toEqual(['c0', null])
    expect(next?.pageParams).toEqual(before.pageParams)
  })
})

describe('applyRead', () => {
  it('stamps the named rows and takes the server count', () => {
    const before = feed([{ items: [n('a'), n('b')], unreadCount: 2 }])
    const next = applyRead(before, ['a'], 1, READ_AT)
    expect(feedItems(next).map((i) => i.readAt)).toEqual([READ_AT, null])
    expect(feedUnreadCount(next)).toBe(1)
  })

  it('marks every row of a group in one pass', () => {
    const before = feed([{ items: [n('a'), n('b'), n('c')], unreadCount: 3 }])
    const next = applyRead(before, ['a', 'b'], 1, READ_AT)
    expect(feedItems(next).map((i) => i.readAt)).toEqual([READ_AT, READ_AT, null])
  })

  it('reaches rows on later pages', () => {
    const before = feed([{ items: [n('a')], unreadCount: 2 }, { items: [n('z')] }])
    const next = applyRead(before, ['z'], 1, READ_AT)
    expect(feedItems(next)[1].readAt).toBe(READ_AT)
  })

  // Re-reading must not move a timestamp the user may be looking at.
  it('leaves the timestamp on an already-read row alone', () => {
    const original = '2026-08-20T09:00:00.000Z'
    const before = feed([{ items: [n('a', { readAt: original })], unreadCount: 0 }])
    expect(feedItems(applyRead(before, ['a'], 0, READ_AT))[0].readAt).toBe(original)
  })

  it('ignores an id it does not hold', () => {
    const before = feed([{ items: [n('a')], unreadCount: 1 }])
    const next = applyRead(before, ['missing'], 1, READ_AT)
    expect(feedItems(next).map((i) => i.readAt)).toEqual([null])
  })

  it('leaves an unfetched feed alone', () => {
    expect(applyRead(undefined, ['a'], 0, READ_AT)).toBeUndefined()
  })
})

describe('applyReadAll', () => {
  it('stamps every unread row across every page and zeroes the count', () => {
    const original = '2026-08-20T09:00:00.000Z'
    const before = feed([
      { items: [n('a'), n('b', { readAt: original })], unreadCount: 5 },
      { items: [n('z')] },
    ])
    const next = applyReadAll(before, READ_AT)
    expect(feedItems(next).map((i) => i.readAt)).toEqual([READ_AT, original, READ_AT])
    expect(feedUnreadCount(next)).toBe(0)
  })

  it('leaves an unfetched feed alone', () => {
    expect(applyReadAll(undefined, READ_AT)).toBeUndefined()
  })
})

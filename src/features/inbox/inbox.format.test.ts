import { describe, expect, it } from 'vitest'
import {
  groupHeadline,
  interrupts,
  isUnread,
  notificationHeadline,
  notificationMeta,
  notificationTone,
  shortSha,
  subjectKey,
  subjectLabel,
  unreadIn,
} from './inbox.format'
import type { AppNotification, NotificationContext } from '@/types/api'

function notification(over: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'n1',
    kind: 'deploy.failed',
    title: 'Deployment failed',
    body: null,
    link: '/deployments/d1',
    context: null,
    readAt: null,
    createdAt: '2026-08-20T12:00:00.000Z',
    ...over,
  }
}

const ctx = (over: NotificationContext = {}): NotificationContext => over

describe('notificationHeadline', () => {
  it('writes a second-person sentence naming the environment', () => {
    const c = ctx({ environmentName: 'production' })
    expect(notificationHeadline(notification({ kind: 'deploy.failed', context: c }))).toBe(
      'Your deploy to production failed',
    )
    expect(notificationHeadline(notification({ kind: 'deploy.succeeded', context: c }))).toBe(
      'Your deploy to production is live',
    )
    expect(notificationHeadline(notification({ kind: 'deploy.cancelled', context: c }))).toBe(
      'Your deploy to production was cancelled',
    )
    expect(notificationHeadline(notification({ kind: 'deploy.skipped_locked', context: c }))).toBe(
      'Your deploy to production was skipped',
    )
    expect(notificationHeadline(notification({ kind: 'lock.overridden', context: c }))).toBe(
      'Your lock on production was overridden',
    )
    expect(
      notificationHeadline(notification({ kind: 'database.provision_failed', context: c })),
    ).toBe('Your database on production failed to provision')
    expect(
      notificationHeadline(notification({ kind: 'database.snapshot_failed', context: c })),
    ).toBe('Your database snapshot on production failed')
  })

  it('falls back to the project when there is no environment', () => {
    const c = ctx({ projectName: 'webhook-test-1' })
    expect(notificationHeadline(notification({ context: c }))).toBe(
      'Your deploy to webhook-test-1 failed',
    )
  })

  it('drops the subject clause entirely rather than saying "to undefined"', () => {
    expect(notificationHeadline(notification({ context: null }))).toBe('Your deploy failed')
    expect(notificationHeadline(notification({ context: ctx({ deploymentId: 'd1' }) }))).toBe(
      'Your deploy failed',
    )
  })

  it('treats a blank name as absent', () => {
    expect(notificationHeadline(notification({ context: ctx({ environmentName: '   ' }) }))).toBe(
      'Your deploy failed',
    )
  })

  // The API can ship a kind before the web knows it; the row must still read.
  it('falls back to the server title for an unknown kind', () => {
    expect(
      notificationHeadline(notification({ kind: 'finding.opened', title: 'A finding was opened' })),
    ).toBe('A finding was opened')
  })
})

describe('groupHeadline', () => {
  it('pluralises per kind and names the subject', () => {
    const c = ctx({ projectName: 'webhook-test-1' })
    expect(groupHeadline('deploy.failed', 3, c)).toBe('3 deploys failed on webhook-test-1')
    expect(groupHeadline('deploy.succeeded', 2, c)).toBe('2 deploys went live on webhook-test-1')
    expect(groupHeadline('deploy.cancelled', 2, c)).toBe(
      '2 deploys were cancelled on webhook-test-1',
    )
    expect(groupHeadline('deploy.skipped_locked', 4, c)).toBe(
      '4 deploys were skipped on webhook-test-1',
    )
    expect(groupHeadline('database.snapshot_failed', 2, c)).toBe(
      '2 database snapshots failed on webhook-test-1',
    )
  })

  it('rewords rather than pluralising a noun that has no plural here', () => {
    expect(groupHeadline('lock.overridden', 2, ctx({ environmentName: 'staging' }))).toBe(
      'Your lock on staging was overridden 2 times',
    )
  })

  it('degrades to a neutral noun for an unknown kind', () => {
    expect(groupHeadline('finding.opened', 3, ctx({ projectName: 'api' }))).toBe('3 updates on api')
  })
})

describe('subjectKey', () => {
  it('prefers the environment, so one project’s two environments stay apart', () => {
    expect(subjectKey(ctx({ environmentId: 'e1', projectId: 'p1' }))).toBe('env:e1')
    expect(subjectKey(ctx({ projectId: 'p1' }))).toBe('project:p1')
  })

  it('falls back to the name only when there is no id', () => {
    expect(subjectKey(ctx({ environmentName: 'production' }))).toBe('name:production')
  })

  it('is null when there is nothing to group by', () => {
    expect(subjectKey(null)).toBeNull()
    expect(subjectKey(ctx({ deploymentId: 'd1' }))).toBeNull()
  })

  it('does not collide two same-named environments in different projects', () => {
    const a = subjectKey(ctx({ environmentId: 'e1', environmentName: 'production' }))
    const b = subjectKey(ctx({ environmentId: 'e2', environmentName: 'production' }))
    expect(a).not.toBe(b)
  })
})

describe('subjectLabel', () => {
  it('prefers the environment name and ignores blanks', () => {
    expect(subjectLabel(ctx({ environmentName: 'production', projectName: 'api' }))).toBe(
      'production',
    )
    expect(subjectLabel(ctx({ environmentName: '', projectName: 'api' }))).toBe('api')
    expect(subjectLabel(null)).toBeNull()
  })
})

describe('interrupts', () => {
  it('is true only for the two that genuinely need a toast', () => {
    expect(interrupts(notification({ kind: 'deploy.failed' }))).toBe(true)
    expect(interrupts(notification({ kind: 'lock.overridden' }))).toBe(true)
  })

  it('is false for everything else, including success and unknown kinds', () => {
    for (const kind of [
      'deploy.succeeded',
      'deploy.cancelled',
      'deploy.skipped_locked',
      'database.provision_failed',
      'database.snapshot_failed',
      'finding.opened',
    ]) {
      expect(interrupts(notification({ kind }))).toBe(false)
    }
  })
})

describe('isUnread', () => {
  it('is read once the server stamps readAt', () => {
    expect(isUnread(notification({ readAt: null }))).toBe(true)
    expect(isUnread(notification({ readAt: '2026-08-20T12:01:00.000Z' }))).toBe(false)
  })

  it('treats a group as unread when any member is', () => {
    const read = notification({ id: 'a', readAt: '2026-08-20T12:01:00.000Z' })
    const unread = notification({ id: 'b', readAt: null })
    expect(unreadIn([read, read])).toBe(false)
    expect(unreadIn([read, unread])).toBe(true)
    expect(unreadIn([])).toBe(false)
  })
})

describe('notificationTone', () => {
  it('maps kinds onto the three signal colours', () => {
    expect(notificationTone('deploy.succeeded')).toBe('ok')
    expect(notificationTone('deploy.failed')).toBe('error')
    expect(notificationTone('database.provision_failed')).toBe('error')
    expect(notificationTone('deploy.cancelled')).toBe('warn')
    expect(notificationTone('lock.overridden')).toBe('warn')
  })

  it('does not claim an unknown kind succeeded', () => {
    expect(notificationTone('finding.opened')).toBe('warn')
  })
})

describe('shortSha', () => {
  it('trims to seven characters', () => {
    expect(shortSha('abc1234def5678')).toBe('abc1234')
    expect(shortSha('abc')).toBe('abc')
  })

  it('is null for a missing or blank sha', () => {
    expect(shortSha(null)).toBeNull()
    expect(shortSha(undefined)).toBeNull()
    expect(shortSha('  ')).toBeNull()
  })
})

describe('notificationMeta', () => {
  it('names the project only when the headline used the environment', () => {
    const n = notification({
      context: ctx({ environmentName: 'production', projectName: 'api', commitSha: 'abc1234def' }),
    })
    expect(notificationMeta(n, '2m ago')).toBe('api · abc1234 · 2m ago')
  })

  it('does not repeat a project the headline already named', () => {
    const n = notification({ context: ctx({ projectName: 'api', commitSha: 'abc1234def' }) })
    expect(notificationMeta(n, '2m ago')).toBe('abc1234 · 2m ago')
  })

  it('collapses to just the age when there is no context', () => {
    expect(notificationMeta(notification(), '2m ago')).toBe('2m ago')
  })

  it('leaves no dangling separator when the age is empty', () => {
    expect(notificationMeta(notification(), '')).toBe('')
  })
})

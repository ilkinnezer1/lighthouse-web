import { describe, expect, it } from 'vitest'
import { issueHref, issueLabel } from './issueLabel'

describe('issueLabel', () => {
  it('joins key and title', () => {
    expect(issueLabel({ issueKey: 'PROJ-12', issueTitle: 'Add login' })).toBe('PROJ-12: Add login')
  })

  it('falls back to the bare key when Jira had no summary', () => {
    expect(issueLabel({ issueKey: 'PROJ-12', issueTitle: null })).toBe('PROJ-12')
  })

  it('is null when the branch names no ticket', () => {
    expect(issueLabel({ issueKey: null, issueTitle: null })).toBeNull()
    expect(issueLabel(null)).toBeNull()
    expect(issueLabel(undefined)).toBeNull()
  })
})

describe('issueHref', () => {
  it('builds a browse link, tolerating a trailing slash', () => {
    expect(issueHref('https://acme.atlassian.net', 'PROJ-12')).toBe(
      'https://acme.atlassian.net/browse/PROJ-12',
    )
    expect(issueHref('https://acme.atlassian.net/', 'PROJ-12')).toBe(
      'https://acme.atlassian.net/browse/PROJ-12',
    )
  })

  it('is null without a site or a key', () => {
    expect(issueHref(null, 'PROJ-12')).toBeNull()
    expect(issueHref('https://acme.atlassian.net', null)).toBeNull()
  })
})

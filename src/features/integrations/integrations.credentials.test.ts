import { describe, expect, it } from 'vitest'
import {
  HAS_REPO_SCOPE_NOTE,
  MISSING_REPO_SCOPE_NOTE,
  canBrowseRepos,
  credentialSubtitle,
  credentialTitle,
  missingRepoScopeCount,
  normalizeToken,
  repoBrowseBlockedNote,
  repoScopeDotClass,
  repoScopeNotice,
  repoScopeState,
  scopeChips,
  showsOauthNotice,
  toCreateInput,
  warnsAboutRepoScope,
} from './integrations.credentials'
import { createGitCredentialSchema } from './integrations.schemas'
import type { GitCredentialView } from '@/types/api'

function credential(over: Partial<GitCredentialView> = {}): GitCredentialView {
  return {
    id: 'gc-1',
    label: null,
    login: 'octocat',
    fingerprint: 'a1b2c3d4',
    scopes: ['repo', 'read:org'],
    hasRepoScope: true,
    createdAt: '2026-08-20T10:00:00.000Z',
    ...over,
  }
}

// A classic PAT created without `repo`. GitHub listed its scopes, and `repo`
// was not among them — the one case where a warning is warranted.
const classicWithoutRepo = credential({
  scopes: ['read:user'],
  hasRepoScope: false,
})

// A fine-grained PAT. GitHub sends no `x-oauth-scopes` header for these, so the
// server has nothing to report and says so with null — not with false.
const fineGrained = credential({
  scopes: [],
  hasRepoScope: null,
})

describe('canBrowseRepos', () => {
  // The bug this replaces: browsing was gated on `providers.github.configured`,
  // so an install with no OAuth App disabled the repo list even once a working
  // token was saved — while the API happily returned private repositories.
  it('allows browsing on a saved token alone, with no OAuth App in sight', () => {
    expect(canBrowseRepos({ connected: false, credentials: [credential()] })).toBe(true)
  })

  it('allows browsing on an OAuth connection alone', () => {
    expect(canBrowseRepos({ connected: true, credentials: [] })).toBe(true)
  })

  it('allows browsing when both are present', () => {
    expect(canBrowseRepos({ connected: true, credentials: [credential()] })).toBe(true)
  })

  // The only blocked case, and exactly when the repos endpoint answers 428.
  it('blocks browsing only when neither exists', () => {
    expect(canBrowseRepos({ connected: false, credentials: [] })).toBe(false)
    expect(canBrowseRepos({})).toBe(false)
    expect(canBrowseRepos({ credentials: null })).toBe(false)
  })

  // A token short of `repo` still reads public repositories, and the server
  // still authenticates with it — so it is not this predicate's business.
  it('does not second-guess what a saved token can reach', () => {
    const short = credential({ hasRepoScope: false, scopes: ['read:user'] })
    expect(canBrowseRepos({ credentials: [short] })).toBe(true)
  })
})

describe('repoBrowseBlockedNote', () => {
  it('points at the token when there is no OAuth App to connect to', () => {
    const note = repoBrowseBlockedNote(true)
    expect(note).toContain('Save an access token')
    expect(note).not.toContain('Connect GitHub above,')
  })

  it('offers both routes when connecting is actually possible', () => {
    const note = repoBrowseBlockedNote(false)
    expect(note).toContain('Connect GitHub above')
    expect(note).toContain('access token')
  })

  // The old copy told people to give up on browsing and paste a URL instead.
  // Saving a token now lights the browser up, so nothing may say otherwise.
  it('never claims the server cannot offer browsing', () => {
    for (const note of [repoBrowseBlockedNote(true), repoBrowseBlockedNote(false)]) {
      expect(note).not.toContain('cannot offer')
      expect(note).not.toContain('repository URL instead')
    }
  })
})

describe('repoScopeState', () => {
  it('reads true as granted', () => {
    expect(repoScopeState(credential({ hasRepoScope: true }))).toBe('granted')
  })

  it('reads false as missing', () => {
    expect(repoScopeState(classicWithoutRepo)).toBe('missing')
  })

  it('reads null as unknown, not as missing', () => {
    expect(repoScopeState(fineGrained)).toBe('unknown')
  })

  it('treats an absent field as unknown too', () => {
    expect(repoScopeState({ hasRepoScope: undefined as unknown as null })).toBe('unknown')
  })

  it('never answers on the scope list alone — an empty list is still unknown', () => {
    expect(repoScopeState(credential({ scopes: [], hasRepoScope: null }))).toBe('unknown')
    expect(repoScopeState(credential({ scopes: ['repo'], hasRepoScope: null }))).toBe('unknown')
  })
})

describe('repoScopeNotice', () => {
  it('warns when GitHub reported scopes and repo was absent', () => {
    const notice = repoScopeNotice(classicWithoutRepo)
    expect(notice).toEqual({ tone: 'warning', text: MISSING_REPO_SCOPE_NOTE })
    expect(notice?.text).toContain('private')
  })

  it('confirms quietly when repo is granted', () => {
    expect(repoScopeNotice(credential())).toEqual({ tone: 'muted', text: HAS_REPO_SCOPE_NOTE })
  })

  // The rule the whole tri-state exists for: warning on a perfectly good
  // fine-grained token sends people chasing a problem they do not have.
  it('says nothing at all when the scopes are unknown', () => {
    expect(repoScopeNotice(fineGrained)).toBeNull()
  })
})

describe('warnsAboutRepoScope', () => {
  it('is true only for an explicit false', () => {
    expect(warnsAboutRepoScope(classicWithoutRepo)).toBe(true)
    expect(warnsAboutRepoScope(credential())).toBe(false)
    expect(warnsAboutRepoScope(fineGrained)).toBe(false)
  })
})

describe('repoScopeDotClass', () => {
  it('gives each of the three states its own signal', () => {
    const granted = repoScopeDotClass(credential())
    const missing = repoScopeDotClass(classicWithoutRepo)
    const unknown = repoScopeDotClass(fineGrained)
    expect(new Set([granted, missing, unknown]).size).toBe(3)
  })

  it('keeps unknown neutral rather than red', () => {
    expect(repoScopeDotClass(fineGrained)).toBe('bg-signal-idle')
    expect(repoScopeDotClass(classicWithoutRepo)).toBe('bg-signal-error')
  })
})

describe('missingRepoScopeCount', () => {
  it('counts only the tokens GitHub said were short of repo', () => {
    expect(missingRepoScopeCount([credential(), classicWithoutRepo, fineGrained])).toBe(1)
  })

  it('is zero for a list of nothing but unknowns', () => {
    expect(missingRepoScopeCount([fineGrained, fineGrained])).toBe(0)
  })

  it('handles an absent list', () => {
    expect(missingRepoScopeCount(null)).toBe(0)
    expect(missingRepoScopeCount(undefined)).toBe(0)
    expect(missingRepoScopeCount([])).toBe(0)
  })
})

describe('credentialTitle', () => {
  it('prefers the label the user chose', () => {
    expect(credentialTitle(credential({ label: 'Work laptop' }))).toBe('Work laptop')
  })

  it('falls back to the account when there is no label', () => {
    expect(credentialTitle(credential({ label: null }))).toBe('octocat')
  })

  it('ignores a whitespace-only label', () => {
    expect(credentialTitle(credential({ label: '   ' }))).toBe('octocat')
  })

  it('still names the row when the API knows neither', () => {
    expect(credentialTitle(credential({ label: null, login: null }))).toBe('Personal access token')
  })
})

describe('credentialSubtitle', () => {
  it('carries the account and the fingerprint', () => {
    expect(credentialSubtitle(credential({ label: 'Work laptop' }))).toBe('octocat · a1b2c3d4')
  })

  it('does not repeat the account the title already showed', () => {
    expect(credentialSubtitle(credential({ label: null }))).toBe('a1b2c3d4')
  })

  it('is empty when neither is known', () => {
    expect(credentialSubtitle(credential({ label: 'x', login: null, fingerprint: null }))).toBe('')
  })
})

describe('scopeChips', () => {
  it('drops duplicates and blanks', () => {
    expect(scopeChips({ scopes: ['repo', ' repo ', '', 'read:org'] })).toEqual(['repo', 'read:org'])
  })

  it('is empty for a token that reported none', () => {
    expect(scopeChips(fineGrained)).toEqual([])
  })
})

describe('normalizeToken', () => {
  it('strips what the clipboard brought along', () => {
    expect(normalizeToken('  ghp_abc123\n')).toBe('ghp_abc123')
  })
})

describe('toCreateInput', () => {
  it('sends the trimmed token and the label', () => {
    expect(toCreateInput({ token: ' ghp_abc123\n', label: ' CI box ' })).toEqual({
      token: 'ghp_abc123',
      label: 'CI box',
    })
  })

  it('omits a blank label rather than storing an empty string', () => {
    expect(toCreateInput({ token: 'ghp_abc123', label: '   ' })).toEqual({ token: 'ghp_abc123' })
    expect(toCreateInput({ token: 'ghp_abc123' })).toEqual({ token: 'ghp_abc123' })
  })
})

describe('createGitCredentialSchema', () => {
  it('refuses an empty token before any request is made', () => {
    const result = createGitCredentialSchema.safeParse({ token: '   ', label: '' })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('Paste a token')
  })

  it('accepts a token with no label', () => {
    expect(createGitCredentialSchema.safeParse({ token: 'ghp_abc', label: '' }).success).toBe(true)
  })

  // Only emptiness is ours to judge — whether GitHub accepts the token is the
  // server's answer, relayed as it arrives.
  it('does not second-guess the token format', () => {
    expect(createGitCredentialSchema.safeParse({ token: 'not-a-real-prefix' }).success).toBe(true)
  })
})

describe('showsOauthNotice', () => {
  it('shows the notice when the server said it has no OAuth App', () => {
    expect(showsOauthNotice({ configured: false })).toBe(true)
  })

  it('stays quiet while the server has not answered yet', () => {
    expect(showsOauthNotice({})).toBe(false)
    expect(showsOauthNotice({ configured: undefined })).toBe(false)
    expect(showsOauthNotice({ configured: null })).toBe(false)
  })

  it('stays quiet on a configured server', () => {
    expect(showsOauthNotice({ configured: true })).toBe(false)
  })

  it('shows it after a callback came back not-configured', () => {
    expect(showsOauthNotice({ callbackFailed: true })).toBe(true)
  })

  // Removing the OAuth App does not remove the token already stored for an
  // account — hiding that panel would hide the only way to disconnect it.
  it('never displaces a live connection', () => {
    expect(showsOauthNotice({ configured: false, connected: true })).toBe(false)
    expect(showsOauthNotice({ callbackFailed: true, connected: true })).toBe(false)
  })
})

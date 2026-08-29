import type { CreateGitCredentialInput, GitCredentialView } from '@/types/api'

export const OAUTH_UNCONFIGURED_TITLE = 'No GitHub OAuth App on this server'

export const OAUTH_UNCONFIGURED_NOTE =
  'This install has no GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET set, so connecting would fail before it reached GitHub. Save a personal access token instead, or ask an administrator to register an OAuth App.'

export const TOKEN_SOURCE_PATH =
  'GitHub → Settings → Developer settings → Personal access tokens (classic)'

export const PUBLIC_REPO_NOTE =
  'Public repositories need no token at all — Lighthouse reads those unauthenticated.'

export const MISSING_REPO_SCOPE_NOTE =
  'Missing the repo scope — this token cannot read your private repositories. Create a new one with repo ticked.'

export const HAS_REPO_SCOPE_NOTE = 'Can read and clone your private repositories.'

export type RepoScopeState = 'granted' | 'missing' | 'unknown'

type ScopeSource = Pick<GitCredentialView, 'hasRepoScope'>

/**
 * `hasRepoScope` is tri-state and the third state is the point. GitHub lists a
 * classic token's grants in `x-oauth-scopes` and sends that header not at all
 * for a fine-grained token, so `null` is "the token did not say" — collapsing
 * it into `false` would warn on every fine-grained token and send people to fix
 * one that already works.
 */
export function repoScopeState(credential: ScopeSource): RepoScopeState {
  if (credential.hasRepoScope === true) return 'granted'
  if (credential.hasRepoScope === false) return 'missing'
  return 'unknown'
}

export interface RepoScopeNotice {
  tone: 'warning' | 'muted'
  text: string
}

/** Null means say nothing — the only honest answer when the scopes are unknown. */
export function repoScopeNotice(credential: ScopeSource): RepoScopeNotice | null {
  switch (repoScopeState(credential)) {
    case 'missing':
      return { tone: 'warning', text: MISSING_REPO_SCOPE_NOTE }
    case 'granted':
      return { tone: 'muted', text: HAS_REPO_SCOPE_NOTE }
    case 'unknown':
      return null
  }
}

export function warnsAboutRepoScope(credential: ScopeSource): boolean {
  return repoScopeState(credential) === 'missing'
}

/** Signal colour for the row's dot. Unknown reads as neutral, never as a fault. */
export function repoScopeDotClass(credential: ScopeSource): string {
  switch (repoScopeState(credential)) {
    case 'missing':
      return 'bg-signal-error'
    case 'granted':
      return 'bg-signal-live'
    case 'unknown':
      return 'bg-signal-idle'
  }
}

export function missingRepoScopeCount(
  credentials: readonly ScopeSource[] | null | undefined,
): number {
  return credentials?.filter(warnsAboutRepoScope).length ?? 0
}

/** The name the user gave it, else the account it belongs to, else a stand-in. */
export function credentialTitle(credential: Pick<GitCredentialView, 'label' | 'login'>): string {
  return credential.label?.trim() || credential.login?.trim() || 'Personal access token'
}

/**
 * `octocat · a1b2c3d4` — the account and the fingerprint, minus whatever the
 * title already said. Empty when neither is known.
 */
export function credentialSubtitle(
  credential: Pick<GitCredentialView, 'label' | 'login' | 'fingerprint'>,
): string {
  const title = credentialTitle(credential)
  const login = credential.login?.trim()
  const fingerprint = credential.fingerprint?.trim()
  return [login === title ? '' : login, fingerprint].filter(Boolean).join(' · ')
}

/** Deduped, blank-free — an empty list renders nothing rather than an empty rail. */
export function scopeChips(credential: Pick<GitCredentialView, 'scopes'>): string[] {
  return [...new Set(credential.scopes.map((s) => s.trim()).filter(Boolean))]
}

/** A pasted token arrives with whatever whitespace the clipboard carried. */
export function normalizeToken(raw: string): string {
  return raw.trim()
}

/** A blank label is no label — it must not be stored as an empty string. */
export function toCreateInput(values: { token: string; label?: string }): CreateGitCredentialInput {
  const label = values.label?.trim()
  const token = normalizeToken(values.token)
  return label ? { token, label } : { token }
}

/**
 * Whether to replace a provider's connect button with the "not configured"
 * notice. Only an explicit `false` withdraws the button: the flag is absent
 * while the overview is in flight and on a server too old to report it, and
 * neither of those is grounds for declaring the install misconfigured. An
 * account connected before the OAuth App was removed keeps its panel, so the
 * notice can never displace a working Disconnect.
 */
export function showsOauthNotice(input: {
  configured?: boolean | null
  connected?: boolean
  callbackFailed?: boolean
}): boolean {
  if (input.connected) return false
  if (input.callbackFailed) return true
  return input.configured === false
}

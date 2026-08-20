import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import DeployDialog from './DeployDialog.vue'
import { makeDeployment } from '@/test/fixtures'
import type { EnvironmentLock } from '@/types/api'

let api: ApiMock

const LOCK: EnvironmentLock = {
  lockedBy: { id: 'u9', username: 'aysel', displayName: 'Aysel', email: 'aysel@example.com' },
  lockedAt: '2026-08-20T11:26:00.000Z',
  expiresAt: '2099-01-01T00:00:00.000Z',
  reason: 'Regression pass on checkout',
}

const DEPLOY_URL = /\/environments\/env-1\/deployments$/
const REFUSED = { status: 409, data: { statusCode: 409, code: 'ENVIRONMENT_LOCKED', lock: LOCK } }

beforeEach(() => {
  api = installApiMock()
  api.get(/\/branches$/, { data: [{ name: 'main' }, { name: 'feature/x' }] })
})

afterEach(() => {
  api.restore()
})

// The dialogs teleport to body, so everything is queried off the document.
function button(match: (label: string) => boolean): HTMLButtonElement {
  const found = [...document.querySelectorAll('button')].find((b) =>
    match(b.textContent?.trim() ?? ''),
  )
  if (!found) {
    const seen = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    throw new Error(`No matching button. Present: ${seen.join(' | ')}`)
  }
  return found
}

function overrideButton(): HTMLButtonElement | undefined {
  return [...document.querySelectorAll('button')].find((b) => b.textContent?.includes('anyway'))
}

async function openDialog() {
  const mounted = await mountApp(DeployDialog, {
    props: { projectId: 'proj-1', envId: 'env-1', defaultBranch: 'main', open: true },
  })
  await settle()
  return mounted.wrapper
}

async function clickDeploy() {
  button((l) => l === 'Deploy').click()
  await settle()
}

function bodyOf(index: number): Record<string, unknown> {
  return (api.callsTo('post', DEPLOY_URL)[index]?.body ?? {}) as Record<string, unknown>
}

describe('deploying into a locked environment', () => {
  it('names the holder and the reason instead of a bare error toast', async () => {
    api.post(DEPLOY_URL, REFUSED)

    await openDialog()
    await clickDeploy()

    const text = document.body.textContent ?? ''
    expect(text).toContain('Aysel')
    expect(text).toContain('Regression pass on checkout')
    expect(text).toContain('audit log')
  })

  // The retry is the point: the same deploy, plus an explicit override.
  it('retries with overrideLock once the override is confirmed', async () => {
    let attempt = 0
    api.post(DEPLOY_URL, () => {
      attempt++
      return attempt === 1 ? REFUSED : { status: 201, data: makeDeployment({ id: 'dep-9' }) }
    })

    const wrapper = await openDialog()
    await clickDeploy()

    overrideButton()!.click()
    await settle()

    expect(api.callsTo('post', DEPLOY_URL)).toHaveLength(2)
    expect(bodyOf(0).overrideLock).toBeUndefined()
    expect(bodyOf(1).overrideLock).toBe(true)
    expect(wrapper.emitted('deployed')?.[0]).toBeTruthy()
  })

  // The override must carry the branch choice, not silently deploy something else.
  it('keeps the chosen branches on the override attempt', async () => {
    let attempt = 0
    api.post(DEPLOY_URL, () => {
      attempt++
      return attempt === 1 ? REFUSED : { status: 201, data: makeDeployment({ id: 'dep-9' }) }
    })

    await openDialog()
    await clickDeploy()
    overrideButton()!.click()
    await settle()

    expect(bodyOf(1).sourceBranch).toBe('main')
  })

  // A 409 that is not a lock conflict must stay an error, not open the override.
  it('does not offer an override for an unrelated 409', async () => {
    api.post(DEPLOY_URL, {
      status: 409,
      data: { statusCode: 409, message: 'A deployment is already running' },
    })

    await openDialog()
    await clickDeploy()

    expect(overrideButton()).toBeUndefined()
    expect(api.callsTo('post', DEPLOY_URL)).toHaveLength(1)
  })

  it('sends no override on a deploy that was never refused', async () => {
    api.post(DEPLOY_URL, { status: 201, data: makeDeployment({ id: 'dep-2' }) })

    await openDialog()
    await clickDeploy()

    expect(api.callsTo('post', DEPLOY_URL)).toHaveLength(1)
    expect(bodyOf(0).overrideLock).toBeUndefined()
    expect(overrideButton()).toBeUndefined()
  })
})

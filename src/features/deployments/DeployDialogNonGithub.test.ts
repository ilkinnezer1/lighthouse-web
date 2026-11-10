import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import DeployDialog from './DeployDialog.vue'
import { makeDeployment } from '@/test/fixtures'

let api: ApiMock

const BRANCHES_URL = /\/branches$/
const DEPLOY_URL = /\/environments\/env-1\/deployments$/

beforeEach(() => {
  api = installApiMock()
  api.get(BRANCHES_URL, { status: 400, data: { statusCode: 400 } })
  api.post(DEPLOY_URL, { status: 201, data: makeDeployment({ id: 'dep-1' }) })
})

afterEach(() => {
  api.restore()
})

async function openDialog() {
  const { wrapper } = await mountApp(DeployDialog, {
    props: {
      projectId: 'proj-1',
      envId: 'env-1',
      defaultBranch: 'main',
      githubLinked: false,
      open: false,
    },
  })
  await wrapper.setProps({ open: true })
  await settle()
}

function sourceInput(): HTMLInputElement {
  return document.querySelector<HTMLInputElement>('#deploy-source-branch')!
}

describe('deploying a project without a GitHub repository', () => {
  it('asks for the branch by name instead of fetching the list', async () => {
    await openDialog()

    expect(api.callsTo('get', BRANCHES_URL)).toHaveLength(0)
    expect(sourceInput().value).toBe('main')
    const text = document.body.textContent ?? ''
    expect(text).toContain('type the branch name')
    expect(text).not.toContain('Merge feature branches')
    expect(text).not.toContain('Fetch')
  })

  it('deploys the typed branch without merges', async () => {
    await openDialog()

    const input = sourceInput()
    input.value = 'release/2.0'
    input.dispatchEvent(new Event('input'))
    await settle()
    ;[...document.querySelectorAll('button')]
      .find((b) => b.textContent?.trim() === 'Deploy')!
      .click()
    await settle()

    const body = api.callsTo('post', DEPLOY_URL)[0]?.body as Record<string, unknown>
    expect(body.sourceBranch).toBe('release/2.0')
    expect(body.mergeBranches).toBeUndefined()
  })
})

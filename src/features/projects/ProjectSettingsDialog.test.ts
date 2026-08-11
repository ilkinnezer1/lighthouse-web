import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BuildConfig, Project } from '@/types/api'
import { installApiMock, type ApiMock } from '@/test/api.mock'
import { mountApp, settle } from '@/test/mount'
import { project as baseProject } from '@/test/fixtures'
import ProjectSettingsDialog from './ProjectSettingsDialog.vue'

vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

let api: ApiMock

beforeEach(() => {
  api = installApiMock()
  api.patch('/projects/proj-1', (call) => ({ data: { ...baseProject, ...(call.body as object) } }))
})

afterEach(() => {
  api.restore()
})

function makeProject(buildConfig: BuildConfig): Project {
  return { ...baseProject, buildConfig }
}

async function openDialog(buildConfig: BuildConfig = {}) {
  const mounted = await mountApp(ProjectSettingsDialog, {
    props: { project: makeProject(buildConfig), open: false },
  })
  await mounted.wrapper.setProps({ open: true })
  await settle()
  return mounted
}

function inputByPlaceholder(placeholder: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`input[placeholder="${placeholder}"]`)
  if (!el) {
    const seen = [...document.querySelectorAll('input')].map((i) => i.getAttribute('placeholder'))
    throw new Error(`No input with placeholder "${placeholder}". Present: ${seen.join(' | ')}`)
  }
  return el
}

function inputById(id: string): HTMLInputElement {
  const el = document.querySelector<HTMLInputElement>(`#${id}`)
  if (!el) throw new Error(`No input #${id}`)
  return el
}

async function setInput(el: HTMLInputElement, value: string) {
  el.value = value
  el.dispatchEvent(new Event('input', { bubbles: true }))
  await settle(1)
}

function clickText(label: string) {
  const el = [...document.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)
  if (!el) {
    const seen = [...document.querySelectorAll('button')].map((b) => b.textContent?.trim())
    throw new Error(`No button labelled "${label}". Present: ${seen.join(' | ')}`)
  }
  el.click()
}

async function save() {
  clickText('Save changes')
  await settle()
}

function savedConfig(): BuildConfig {
  const calls = api.callsTo('patch', '/projects/proj-1')
  if (!calls.length) throw new Error('No PATCH was sent')
  return (calls.at(-1)!.body as { buildConfig: BuildConfig }).buildConfig
}

describe('ProjectSettingsDialog — seeding from the project', () => {
  it('renders nothing until it is opened', async () => {
    await mountApp(ProjectSettingsDialog, {
      props: { project: makeProject({ image: 'nginx:1.27' }), open: false },
    })
    await settle()

    expect(document.body.textContent).not.toContain('Build settings')
  })

  it('preselects the stored build strategy and its hint', async () => {
    await openDialog({ strategy: 'railpack' })

    expect(document.body.textContent).toContain("Nixpacks' successor")
  })

  it('defaults to auto-detect when the project stores no strategy', async () => {
    await openDialog({})

    expect(document.body.textContent).toContain('Compose file, then Dockerfile')
  })

  it('seeds the source-build fields from the stored config', async () => {
    await openDialog({
      strategy: 'nixpacks',
      buildCommand: 'npm run build',
      startCommand: 'node server.js',
      runtimeVersion: '20',
      rootDir: 'apps/api',
    })

    expect(inputById('bc-build-cmd').value).toBe('npm run build')
    expect(inputByPlaceholder('start command, e.g. node server.js').value).toBe('node server.js')
    expect(inputByPlaceholder('runtime version, e.g. 20').value).toBe('20')
    expect(inputByPlaceholder('root dir, e.g. apps/api').value).toBe('apps/api')
  })

  it('joins argv arrays back into a single editable line', async () => {
    await openDialog({ cmd: ['node', 'server.js'], dbMigrate: ['npx', 'prisma', 'migrate'] })

    expect(inputById('bc-cmd').value).toBe('node server.js')
    expect(inputById('bc-migrate').value).toBe('npx prisma migrate')
  })

  it('classifies a non-preset builder as a custom image', async () => {
    await openDialog({ strategy: 'buildpacks', builder: 'ghcr.io/acme/builder:latest' })

    expect(inputByPlaceholder('ghcr.io/acme/builder:latest').value).toBe(
      'ghcr.io/acme/builder:latest',
    )
  })

  it('reveals the advanced setup-step controls only for steps that use them', async () => {
    await openDialog({
      setupSteps: [{ command: 'make setup' }, { command: 'make image', image: 'node:20' }],
    })

    expect(document.querySelectorAll('input[placeholder^="image with your"]').length).toBe(1)
  })

  it('reseeds from the project when reopened, discarding unsaved edits', async () => {
    const { wrapper } = await openDialog({ composePath: 'docker/compose.yml' })
    await setInput(inputById('bc-compose'), 'edited.yml')
    expect(inputById('bc-compose').value).toBe('edited.yml')

    await wrapper.setProps({ open: false })
    await settle()
    await wrapper.setProps({ open: true })
    await settle()

    expect(inputById('bc-compose').value).toBe('docker/compose.yml')
  })
})

describe('ProjectSettingsDialog — assembling the saved build config', () => {
  it('sends an empty object when nothing is configured', async () => {
    await openDialog({})
    await save()

    expect(savedConfig()).toEqual({})
  })

  it('omits the strategy when it is left on auto-detect', async () => {
    await openDialog({ web: 'api' })
    await save()

    expect(savedConfig()).toEqual({ web: 'api' })
  })

  it('round-trips a stored config unchanged when nothing is edited', async () => {
    const stored: BuildConfig = {
      strategy: 'nixpacks',
      buildCommand: 'npm run build',
      startCommand: 'node server.js',
      runtimeVersion: '20',
      rootDir: 'apps/api',
      web: 'api',
      cmd: ['node', 'server.js'],
      dbMigrate: ['npx', 'prisma', 'migrate', 'deploy'],
      envs: { NODE_ENV: 'production' },
      composePath: 'docker/compose.yml',
      volumes: [{ name: 'uploads', path: '/app/storage' }],
      cpuLimit: 0.5,
      memoryMb: 512,
      port: 3000,
      setupSteps: [{ command: 'make setup' }],
      maintenanceActions: [
        { id: 'migrate', label: 'Run migrations', service: 'web', command: 'npm run migrate' },
      ],
    }
    await openDialog(stored)
    await save()

    expect(savedConfig()).toEqual(stored)
  })

  it('splits whitespace-separated argv lines back into arrays', async () => {
    await openDialog({})
    await setInput(inputById('bc-cmd'), '  node   server.js  ')
    await save()

    expect(savedConfig().cmd).toEqual(['node', 'server.js'])
  })

  it('drops env rows with a blank key but keeps blank values', async () => {
    await openDialog({ envs: { KEEP: 'yes', DROP_ME: '' } })
    const keys = [...document.querySelectorAll<HTMLInputElement>('input[placeholder="KEY"]')]
    const blank = keys.find((k) => k.value === 'DROP_ME')!
    await setInput(blank, '   ')
    await save()

    expect(savedConfig().envs).toEqual({ KEEP: 'yes' })
  })

  it('omits volumes that are only half filled in', async () => {
    await openDialog({})
    clickText('Add')
    await settle()
    await setInput(inputByPlaceholder('uploads'), 'data')
    await save()

    expect(savedConfig().volumes).toBeUndefined()
  })

  it('keeps a fully specified volume', async () => {
    await openDialog({})
    clickText('Add')
    await settle()
    await setInput(inputByPlaceholder('uploads'), 'data')
    await setInput(inputByPlaceholder('/app/storage/uploads'), '/var/lib/data')
    await save()

    expect(savedConfig().volumes).toEqual([{ name: 'data', path: '/var/lib/data' }])
  })
})

describe('ProjectSettingsDialog — strategy gates which knobs persist', () => {
  it('drops the source-build knobs when the strategy cannot read them', async () => {
    await openDialog({ strategy: 'nixpacks', buildCommand: 'npm run build', rootDir: 'apps/api' })
    clickText('Prebuilt image')
    await settle()
    await save()

    const saved = savedConfig()
    expect(saved.buildCommand).toBeUndefined()
    expect(saved.rootDir).toBeUndefined()
    expect(saved.strategy).toBe('image')
  })

  it('keeps the source-build knobs for a from-source strategy', async () => {
    await openDialog({ strategy: 'nixpacks', buildCommand: 'npm run build' })
    clickText('Railpack')
    await settle()
    await save()

    expect(savedConfig().buildCommand).toBe('npm run build')
  })

  it('persists the image only for the prebuilt-image strategy', async () => {
    await openDialog({ strategy: 'image', image: 'nginx:1.27' })
    await save()
    expect(savedConfig().image).toBe('nginx:1.27')

    await openDialog({ strategy: 'image', image: 'nginx:1.27' })
    clickText('Dockerfile')
    await settle()
    await save()
    expect(savedConfig().image).toBeUndefined()
  })

  it('drops resource limits for a compose build, which reads them from the file', async () => {
    await openDialog({ strategy: 'dockerfile', cpuLimit: 0.5, memoryMb: 512 })
    clickText('Compose')
    await settle()
    await save()

    const saved = savedConfig()
    expect(saved.cpuLimit).toBeUndefined()
    expect(saved.memoryMb).toBeUndefined()
  })

  it('keeps the port even for a compose build', async () => {
    await openDialog({ strategy: 'compose', port: 8080 })
    await save()

    expect(savedConfig().port).toBe(8080)
  })

  it('persists the builder and buildpacks only for the buildpacks strategy', async () => {
    await openDialog({ strategy: 'buildpacks', builder: 'paketo', buildpacks: ['acme/pack'] })
    await save()
    expect(savedConfig()).toMatchObject({ builder: 'paketo', buildpacks: ['acme/pack'] })

    await openDialog({ strategy: 'buildpacks', builder: 'paketo', buildpacks: ['acme/pack'] })
    clickText('Nixpacks')
    await settle()
    await save()
    const saved = savedConfig()
    expect(saved.builder).toBeUndefined()
    expect(saved.buildpacks).toBeUndefined()
  })

  it('splits buildpacks on commas as well as whitespace', async () => {
    await openDialog({ strategy: 'buildpacks' })
    await setInput(
      inputByPlaceholder('extra buildpacks, e.g. paketo-buildpacks/nodejs'),
      'a/one, b/two  c/three',
    )
    await save()

    expect(savedConfig().buildpacks).toEqual(['a/one', 'b/two', 'c/three'])
  })

  it('hides the volumes section for a compose build', async () => {
    await openDialog({ strategy: 'compose' })

    expect(document.body.textContent).not.toContain('Persistent volumes')
  })

  it('rejects a non-numeric port rather than sending NaN', async () => {
    await openDialog({ strategy: 'image' })
    await setInput(inputByPlaceholder('port the image listens on, e.g. 80'), 'eighty')
    await save()

    expect(savedConfig().port).toBeUndefined()
  })
})

describe('ProjectSettingsDialog — maintenance action ids', () => {
  it('derives an id from the label for a new action', async () => {
    await openDialog({})
    const addButtons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Add',
    )
    addButtons.at(-1)!.click()
    await settle()

    await setInput(inputByPlaceholder('Label (e.g. Run migrations)'), 'Clear the cache!')
    await setInput(inputByPlaceholder('service (e.g. web)'), 'web')
    await setInput(
      inputByPlaceholder('command (e.g. php artisan migrate --force)'),
      'php artisan cache:clear',
    )
    await save()

    expect(savedConfig().maintenanceActions).toEqual([
      {
        id: 'clear-the-cache',
        label: 'Clear the cache!',
        service: 'web',
        command: 'php artisan cache:clear',
      },
    ])
  })

  it('keeps the stored id so existing Run buttons stay mapped', async () => {
    await openDialog({
      maintenanceActions: [
        { id: 'legacy-id', label: 'Renamed label', service: 'web', command: 'echo 1' },
      ],
    })
    await save()

    expect(savedConfig().maintenanceActions?.[0].id).toBe('legacy-id')
  })

  it('drops actions that are not fully specified', async () => {
    await openDialog({
      maintenanceActions: [
        { id: 'a', label: 'Complete', service: 'web', command: 'echo 1' },
        { id: 'b', label: 'Incomplete', service: '', command: 'echo 2' },
      ],
    })
    await save()

    expect(savedConfig().maintenanceActions).toHaveLength(1)
    expect(savedConfig().maintenanceActions?.[0].id).toBe('a')
  })

  it('preserves the destructive flag only when it is set', async () => {
    await openDialog({
      maintenanceActions: [
        { id: 'a', label: 'Safe', service: 'web', command: 'echo 1' },
        { id: 'b', label: 'Wipe', service: 'db', command: 'drop', destructive: true },
      ],
    })
    await save()

    const actions = savedConfig().maintenanceActions!
    expect(actions[0].destructive).toBeUndefined()
    expect(actions[1].destructive).toBe(true)
  })
})

describe('ProjectSettingsDialog — setup steps', () => {
  it('drops steps with no command', async () => {
    await openDialog({ setupSteps: [{ command: 'make setup' }] })
    const addButtons = [...document.querySelectorAll('button')].filter(
      (b) => b.textContent?.trim() === 'Add',
    )
    addButtons[1].click()
    await settle()
    await save()

    expect(savedConfig().setupSteps).toEqual([{ command: 'make setup' }])
  })

  it('omits an empty image and an unset docker flag', async () => {
    await openDialog({ setupSteps: [{ command: 'make setup', image: '', docker: false }] })
    await save()

    expect(savedConfig().setupSteps).toEqual([{ command: 'make setup' }])
  })

  it('reorders steps with the move controls', async () => {
    await openDialog({
      setupSteps: [{ command: 'first' }, { command: 'second' }, { command: 'third' }],
    })

    const downButtons = [
      ...document.querySelectorAll<HTMLButtonElement>('button[title="Move down"]'),
    ]
    downButtons[0].click()
    await settle()
    await save()

    expect(savedConfig().setupSteps).toEqual([
      { command: 'second' },
      { command: 'first' },
      { command: 'third' },
    ])
  })

  it('disables the move controls at the ends of the list', async () => {
    await openDialog({ setupSteps: [{ command: 'first' }, { command: 'second' }] })

    const up = [...document.querySelectorAll<HTMLButtonElement>('button[title="Move up"]')]
    const down = [...document.querySelectorAll<HTMLButtonElement>('button[title="Move down"]')]
    expect(up[0].disabled).toBe(true)
    expect(up[1].disabled).toBe(false)
    expect(down[0].disabled).toBe(false)
    expect(down[1].disabled).toBe(true)
  })
})

describe('ProjectSettingsDialog — saving', () => {
  it('asks to close after a successful save', async () => {
    const { wrapper } = await openDialog({})
    await save()

    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })

  it('stays open and keeps the edits when the save fails', async () => {
    api.patch('/projects/proj-1', { status: 400, data: { message: 'buildConfig is invalid' } })
    const { wrapper } = await openDialog({ composePath: 'docker/compose.yml' })
    await save()

    expect(wrapper.emitted('update:open')).toBeUndefined()
    expect(inputById('bc-compose').value).toBe('docker/compose.yml')
  })

  it('re-enables the save button after a failure so the user can retry', async () => {
    api.patch('/projects/proj-1', { status: 500, data: {} })
    await openDialog({})
    await save()

    const saveButton = [...document.querySelectorAll('button')].find((b) =>
      b.textContent?.includes('Save changes'),
    )
    expect(saveButton?.disabled).toBe(false)
  })

  it('does not send anything when the dialog is cancelled', async () => {
    const { wrapper } = await openDialog({})
    clickText('Cancel')
    await settle()

    expect(api.callsTo('patch', '/projects/proj-1')).toHaveLength(0)
    expect(wrapper.emitted('update:open')?.at(-1)).toEqual([false])
  })
})

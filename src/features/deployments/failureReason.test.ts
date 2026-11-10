import { describe, expect, it } from 'vitest'
import { failureReason } from './failureReason'

describe('failureReason', () => {
  it('is null when the deployment recorded no reason', () => {
    expect(failureReason(null)).toBeNull()
    expect(failureReason(undefined)).toBeNull()
    expect(failureReason('   ')).toBeNull()
  })

  // This exact shape is produced by the worker's runMerge and pinned on the Go
  // side by TestMergeConflictMessageFormat.
  it('reads a merge conflict, naming both branches and the files', () => {
    const r = failureReason(
      'clone: merge feature/PROJ-12-add-login into main: conflicts in src/app.ts, src/router.ts',
    )
    expect(r).toMatchObject({
      kind: 'merge-conflict',
      title: 'Merge conflict — feature/PROJ-12-add-login into main',
      files: ['src/app.ts', 'src/router.ts'],
    })
    expect(r?.hint).toContain('feature/PROJ-12-add-login')
    // The raw line is never dropped.
    expect(r?.detail).toContain('conflicts in src/app.ts')
  })

  it('handles a single conflicting file', () => {
    const r = failureReason('clone: merge feat/a into main: conflicts in README.md')
    expect(r?.files).toEqual(['README.md'])
  })

  it('reads a branch that could no longer be fetched', () => {
    const r = failureReason('clone: fetch feature/gone (a1b2c3d): exit status 128')
    expect(r?.kind).toBe('branch-missing')
    expect(r?.title).toContain('feature/gone')
  })

  it('separates a missing builder from a broken build', () => {
    const missing = failureReason(
      'build: nixpacks not found on PATH — install it on the worker host/image: exec: "nixpacks"',
    )
    expect(missing?.kind).toBe('builder-missing')
    expect(missing?.hint).toContain('administrator')

    const broke = failureReason('build: docker build: exit status 1')
    expect(broke?.kind).toBe('build-failed')
  })

  it('reads the build strategies that can fail', () => {
    for (const msg of [
      'build: docker compose build: exit status 1',
      'build: pack build: exit status 1',
      'build: railpack build: exit status 1',
      'build: docker pull nginx:latest: not found',
    ]) {
      expect(failureReason(msg)?.kind).toBe('build-failed')
    }
  })

  it('reads an unrecognized build method', () => {
    expect(failureReason('build: unknown build strategy for project')?.kind).toBe(
      'unknown-strategy',
    )
  })

  it('reads a legacy health check timeout without leaking the Go client error', () => {
    const raw =
      'health_check: health check timed out after 30s: Get "http://172.25.0.9:8080/": context deadline exceeded (Client.Timeout exceeded while awaiting headers)'
    const r = failureReason(raw)
    expect(r).toMatchObject({
      kind: 'health-check',
      title: 'The app never answered on its port',
      detail: raw,
    })
    expect(r?.hint).toContain('30s')
    expect(r?.hint).not.toContain('172.25')
    expect(r?.hint).not.toContain('Client.Timeout')
  })

  it('reads a bare legacy health check timeout', () => {
    const r = failureReason('health_check: health check timed out after 1m0s')
    expect(r?.title).toBe('The app never answered on its port')
    expect(r?.hint).toContain('1m0s')
  })

  // Pinned on the Go side by the worker's health-check error wording.
  it('reads a container that crashed before answering, keeping its last log line', () => {
    const r = failureReason(
      "health_check: container exited (code 1) before answering on port 8080: Error: Cannot find module '/app/dist/main.js'",
    )
    expect(r).toMatchObject({
      kind: 'health-check',
      title: 'The app crashed on start',
      lastLog: "Error: Cannot find module '/app/dist/main.js'",
    })
    expect(r?.hint).toContain('code 1')
    expect(r?.hint).toContain('port 8080')
  })

  it('reads a crash on start that logged nothing', () => {
    const r = failureReason(
      'health_check: container exited (code 137) before answering on port 3000',
    )
    expect(r?.title).toBe('The app crashed on start')
    expect(r?.hint).toContain('code 137')
    expect(r?.lastLog).toBeUndefined()
  })

  it('reads an app that stayed up but never answered', () => {
    const r = failureReason('health_check: app did not answer on port 8080 within 30s')
    expect(r).toMatchObject({ kind: 'health-check', title: 'The app never answered on port 8080' })
    expect(r?.hint).toContain('30s')
    expect(r?.hint).toContain('listens')
    expect(r?.lastLog).toBeUndefined()
  })

  it('never puts an internal address in a health check title', () => {
    for (const msg of [
      'health_check: health check timed out after 30s: Get "http://172.25.0.9:8080/": context deadline exceeded',
      'health_check: container exited (code 1) before answering on port 8080: listen 172.25.0.9:8080 failed',
      'health_check: app did not answer on port 8080 within 30s',
      'health_check: dial tcp 172.25.0.9:8080: connection refused',
    ]) {
      expect(failureReason(msg)?.title).not.toMatch(/\d+\.\d+\.\d+\.\d+/)
    }
  })

  it('reads a non-timeout health check failure from its stage', () => {
    expect(failureReason('health_check: container exited with code 1')?.kind).toBe('health-check')
  })

  // Pinned on the Go side by TestParseNamesIncludeAsTheCause.
  it('explains an unresolvable compose include instead of showing a bare open error', () => {
    const r = failureReason(
      'run: parse compose: compose include could not be resolved (a project deploys one repository): load compose: open /w/database/docker-compose.yml: no such file or directory',
    )
    expect(r?.kind).toBe('compose-include')
    expect(r?.hint).toContain('one repository')
  })

  it('names the env_file that points outside the checkout', () => {
    const r = failureReason('run: env_file ../secrets.env: path "../secrets.env" escapes workdir')
    expect(r?.kind).toBe('compose-env-file')
    expect(r?.title).toContain('../secrets.env')
  })

  it('treats a cancellation as its own thing, not a failure', () => {
    const r = failureReason('cancelled by user request')
    expect(r?.kind).toBe('cancelled')
    expect(r?.hint).toContain('did not fail')
  })

  // A failure mode nobody has classified yet must still reach the user intact.
  it('falls back to the raw line for anything unrecognized', () => {
    const r = failureReason('setup: something nobody has seen before')
    expect(r).toMatchObject({
      kind: 'unknown',
      title: 'Deployment failed',
      detail: 'setup: something nobody has seen before',
    })
    expect(r?.hint).toBeUndefined()
  })

  it('classifies a message with no stage prefix', () => {
    expect(failureReason('merge a into b: conflicts in x.ts')?.kind).toBe('merge-conflict')
  })
})

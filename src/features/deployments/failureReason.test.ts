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

  it('reads a health check timeout, keeping the duration', () => {
    const r = failureReason('health_check: health check timed out after 60s')
    expect(r?.kind).toBe('health-check')
    expect(r?.title).toContain('60s')
  })

  it('reads a non-timeout health check failure from its stage', () => {
    expect(failureReason('health_check: container exited with code 1')?.kind).toBe('health-check')
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

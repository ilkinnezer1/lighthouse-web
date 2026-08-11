import { describe, expect, it } from 'vitest'
import { cn, formatBytes, shortSha, titleCase } from './utils'

describe('formatBytes', () => {
  it('renders an em dash for a genuinely absent value', () => {
    expect(formatBytes(null)).toBe('—')
    expect(formatBytes(undefined)).toBe('—')
  })

  it("maps Docker's -1 sentinel to 'size unknown'", () => {
    expect(formatBytes(-1)).toBe('size unknown')
    expect(formatBytes('-1')).toBe('size unknown')
  })

  it('keeps the em dash for negatives that are not the sentinel', () => {
    expect(formatBytes(-2)).toBe('—')
    expect(formatBytes(-1024)).toBe('—')
  })

  it('renders an em dash for values that are not finite numbers', () => {
    expect(formatBytes(Number.NaN)).toBe('—')
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe('—')
    expect(formatBytes('not a number')).toBe('—')
  })

  it('renders sub-kilobyte values as whole bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(1)).toBe('1 B')
    expect(formatBytes(1023)).toBe('1023 B')
  })

  it('switches to one decimal place below ten of a unit', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(9 * 1024)).toBe('9.0 KB')
  })

  it('drops the decimal place at ten of a unit and above', () => {
    expect(formatBytes(10 * 1024)).toBe('10 KB')
    expect(formatBytes(999 * 1024)).toBe('999 KB')
  })

  it('climbs units up to petabytes', () => {
    expect(formatBytes(1024 ** 2)).toBe('1.0 MB')
    expect(formatBytes(1024 ** 3)).toBe('1.0 GB')
    expect(formatBytes(1024 ** 4)).toBe('1.0 TB')
    expect(formatBytes(1024 ** 5)).toBe('1.0 PB')
  })

  it('stays in petabytes beyond the largest unit', () => {
    expect(formatBytes(2048 * 1024 ** 5)).toBe('2048 PB')
  })

  it('accepts the decimal strings the API sends for BigInt columns', () => {
    expect(formatBytes('2048')).toBe('2.0 KB')
    expect(formatBytes('0')).toBe('0 B')
  })
})

describe('shortSha', () => {
  it('truncates to seven characters', () => {
    expect(shortSha('0123456789abcdef')).toBe('0123456')
  })

  it('returns null rather than a placeholder for absent values', () => {
    expect(shortSha(null)).toBeNull()
    expect(shortSha(undefined)).toBeNull()
    expect(shortSha('')).toBeNull()
  })

  it('leaves a sha shorter than seven characters alone', () => {
    expect(shortSha('abc')).toBe('abc')
  })
})

describe('titleCase', () => {
  it('lowercases everything after the first character', () => {
    expect(titleCase('SUCCEEDED')).toBe('Succeeded')
    expect(titleCase('ROLLED_BACK')).toBe('Rolled_back')
  })

  it('does not uppercase an already-lowercase first character', () => {
    expect(titleCase('running')).toBe('running')
  })

  it('returns an empty string unchanged', () => {
    expect(titleCase('')).toBe('')
  })
})

describe('cn', () => {
  it('lets a later tailwind class win over an earlier conflicting one', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4')
  })

  it('drops falsy entries', () => {
    const hidden = false
    expect(cn('flex', hidden && 'hidden', undefined, null, 'gap-2')).toBe('flex gap-2')
  })
})

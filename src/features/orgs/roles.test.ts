import { describe, expect, it } from 'vitest'
import type { OrgRole } from '@/types/api'
import {
  ORG_ROLES,
  ROLE_BADGE,
  ROLE_CAPABILITIES,
  ROLE_DESCRIPTION,
  ROLE_LABEL,
  canManageRole,
  roleCan,
  type Capability,
} from './roles'

const ALL_CAPS: Capability[] = [
  'read',
  'project.create',
  'deploy',
  'env.manage',
  'exec',
  'snapshots.restore',
  'project.delete',
  'project.transfer',
  'members.manage',
  'audit.read',
  'notifications.manage',
  'jira.manage',
  'org.update',
  'org.delete',
  'org.transfer',
]

function capsOf(role: OrgRole): Capability[] {
  return ALL_CAPS.filter((c) => roleCan(role, c))
}

describe('roleCan', () => {
  it('denies everything when the role has not resolved yet', () => {
    for (const cap of ALL_CAPS) expect(roleCan(undefined, cap)).toBe(false)
  })

  it('gives a Viewer read and nothing else', () => {
    expect(capsOf('VIEWER')).toEqual(['read'])
  })

  it('adds the write tier for a Member', () => {
    expect(capsOf('MEMBER')).toEqual([
      'read',
      'project.create',
      'deploy',
      'env.manage',
      'exec',
      'snapshots.restore',
    ])
  })

  it('withholds destructive and org-management tiers from a Member', () => {
    for (const cap of ['project.delete', 'members.manage', 'audit.read', 'org.update'] as const) {
      expect(roleCan('MEMBER', cap)).toBe(false)
    }
  })

  it('adds the admin tier but no org-level control for an Admin', () => {
    expect(roleCan('ADMIN', 'members.manage')).toBe(true)
    expect(roleCan('ADMIN', 'project.delete')).toBe(true)
    expect(roleCan('ADMIN', 'audit.read')).toBe(true)
    expect(roleCan('ADMIN', 'jira.manage')).toBe(true)
    expect(roleCan('ADMIN', 'org.update')).toBe(false)
    expect(roleCan('ADMIN', 'org.delete')).toBe(false)
    expect(roleCan('ADMIN', 'org.transfer')).toBe(false)
  })

  it('gives an Owner every capability', () => {
    expect(capsOf('OWNER')).toEqual(ALL_CAPS)
  })

  it('nests the tiers, so each role is a superset of the one below it', () => {
    const ordered: OrgRole[] = ['VIEWER', 'MEMBER', 'ADMIN', 'OWNER']
    for (let i = 1; i < ordered.length; i++) {
      const lower = ROLE_CAPABILITIES[ordered[i - 1]]
      const higher = ROLE_CAPABILITIES[ordered[i]]
      for (const cap of lower) expect(higher.has(cap)).toBe(true)
      expect(higher.size).toBeGreaterThan(lower.size)
    }
  })
})

describe('canManageRole', () => {
  it('lets an Owner manage any role, including another Owner', () => {
    for (const target of ORG_ROLES) expect(canManageRole('OWNER', target)).toBe(true)
  })

  it('stops an Admin touching an Owner while allowing the rest', () => {
    expect(canManageRole('ADMIN', 'OWNER')).toBe(false)
    expect(canManageRole('ADMIN', 'ADMIN')).toBe(true)
    expect(canManageRole('ADMIN', 'MEMBER')).toBe(true)
    expect(canManageRole('ADMIN', 'VIEWER')).toBe(true)
  })

  it('stops a Member or Viewer managing anyone', () => {
    for (const actor of ['MEMBER', 'VIEWER'] as const) {
      for (const target of ORG_ROLES) expect(canManageRole(actor, target)).toBe(false)
    }
  })

  it('denies an unresolved actor role', () => {
    for (const target of ORG_ROLES) expect(canManageRole(undefined, target)).toBe(false)
  })
})

describe('role presentation maps', () => {
  it('cover every role', () => {
    for (const role of ORG_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy()
      expect(ROLE_DESCRIPTION[role]).toBeTruthy()
      expect(ROLE_BADGE[role]).toBeTruthy()
    }
  })

  it('lists the roles from most to least privileged', () => {
    expect(ORG_ROLES).toEqual(['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'])
  })
})

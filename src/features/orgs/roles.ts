import type { BadgeVariants } from '@/components/ui/badge'
import type { OrgRole } from '@/types/api'

export const ORG_ROLES: OrgRole[] = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER']

export const ROLE_LABEL: Record<OrgRole, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}

export const ROLE_DESCRIPTION: Record<OrgRole, string> = {
  OWNER: 'Full control, including renaming or deleting the organization.',
  ADMIN: 'Manage members, invites, the activity log, and delete projects.',
  MEMBER: 'Create, deploy, and manage projects and their data.',
  VIEWER: 'Read-only access to projects, deployments, and databases.',
}

export const ROLE_BADGE: Record<OrgRole, BadgeVariants['variant']> = {
  OWNER: 'default',
  ADMIN: 'secondary',
  MEMBER: 'outline',
  VIEWER: 'outline',
}

// UI capabilities, mirroring the server's ROLE_CAPABILITIES tiers (read for all;
// Member adds writes; Admin adds delete-project/manage-members/audit; Owner adds
// org rename/delete/transfer). Client gating is cosmetic — the API is the gate.
export type Capability =
  | 'read'
  | 'project.create'
  | 'deploy'
  | 'env.manage'
  | 'exec'
  | 'project.delete'
  | 'project.transfer'
  | 'members.manage'
  | 'audit.read'
  | 'notifications.manage'
  | 'jira.manage'
  | 'org.update'
  | 'org.delete'
  | 'org.transfer'

const READ: Capability[] = ['read']
const WRITE: Capability[] = ['project.create', 'deploy', 'env.manage', 'exec']
const ADMIN: Capability[] = [
  'project.delete',
  'project.transfer',
  'members.manage',
  'audit.read',
  'notifications.manage',
  'jira.manage',
]
const OWNER: Capability[] = ['org.update', 'org.delete', 'org.transfer']

const VIEWER_CAPS = READ
const MEMBER_CAPS = [...VIEWER_CAPS, ...WRITE]
const ADMIN_CAPS = [...MEMBER_CAPS, ...ADMIN]
const OWNER_CAPS = [...ADMIN_CAPS, ...OWNER]

export const ROLE_CAPABILITIES: Record<OrgRole, ReadonlySet<Capability>> = {
  OWNER: new Set(OWNER_CAPS),
  ADMIN: new Set(ADMIN_CAPS),
  MEMBER: new Set(MEMBER_CAPS),
  VIEWER: new Set(VIEWER_CAPS),
}

export function roleCan(role: OrgRole | undefined, cap: Capability): boolean {
  return role ? ROLE_CAPABILITIES[role].has(cap) : false
}

// True when `actor` may set a member's role to/from `target`'s without violating
// the server guardrails (only an Owner may touch an Owner / grant ownership).
export function canManageRole(actor: OrgRole | undefined, target: OrgRole): boolean {
  if (!roleCan(actor, 'members.manage')) return false
  if (target === 'OWNER' && actor !== 'OWNER') return false
  return true
}

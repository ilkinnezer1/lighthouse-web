// Enums are string unions (tsconfig `erasableSyntaxOnly` forbids TS `enum`).
export type UserRole = 'USER' | 'ADMIN'

// Org-wide role; mirrors the API's OrgRole enum and drives the capability matrix.
export type OrgRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'REVOKED' | 'EXPIRED'

// Shape returned by create/rename (ORG_SELECT) — no caller role attached.
export interface OrgSummary {
  id: string
  name: string
  slug: string
  isPersonal: boolean
  createdAt: string
}

// GET /orgs annotates each org with the caller's own role in it.
export interface Organization extends OrgSummary {
  role: OrgRole
}

export interface OrgMember {
  userId: string
  username: string
  displayName: string | null
  role: OrgRole
  joinedAt: string
}

// An org's pending invite (Admin+ view). Either an in-app invite of an existing
// user (`invitee` set) or a link invite (`invitee` null, optional `email`).
export interface OrgInvitation {
  id: string
  role: OrgRole
  status: InvitationStatus
  email: string | null
  expiresAt: string
  createdAt: string
  invitee: { id: string; username: string; displayName: string | null } | null
  invitedBy: { username: string }
}

// The caller's own pending in-app invite (their inbox).
export interface MyInvitation {
  id: string
  role: OrgRole
  expiresAt: string
  createdAt: string
  organization: { id: string; name: string; slug: string }
  invitedBy: { username: string }
}

// Minting a link invite returns the one-time URL under `tokenLink` — shown once,
// never re-fetchable (the DB keeps only its hash).
export interface InviteLinkResult {
  id: string
  role: OrgRole
  expiresAt: string
  createdAt: string
  tokenLink: string
}

export interface CreateInvitationInput {
  role: OrgRole
  username?: string
  email?: string
}

// GET /invite/:token preview for the accept page.
export interface InvitePreview {
  orgName: string
  role: OrgRole
  inviterUsername: string
}

export interface AcceptLinkResult {
  orgId: string
  role: OrgRole
}

export type EnvironmentType = 'PRODUCTION' | 'PREVIEW' | 'MANUAL'

export type DatabaseType = 'POSTGRES' | 'MYSQL' | 'REDIS' | 'MONGO'

export type DeploymentStatus =
  | 'QUEUED'
  | 'CLONING'
  | 'BUILDING'
  | 'PUSHING'
  | 'STARTING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED'

export type DeploymentStageStatus =
  | 'PENDING'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'SKIPPED'
  | 'ROLLED_BACK'

export type DatabaseStatus = 'PROVISIONING' | 'READY' | 'FAILED'

export type SnapshotStatus = 'PENDING' | 'READY' | 'FAILED'

export type CreateDatabaseMode =
  | 'attach-existing'
  | 'create-empty'
  | 'copy'
  | 'create-from-snapshot'

export interface User {
  id: string
  email: string
  username: string
  displayName: string | null
  role: UserRole
  createdAt: string
  lastLoginAt: string | null
}

export type BuildStrategy =
  | 'dockerfile'
  | 'compose'
  | 'generated'
  | 'nixpacks'
  | 'buildpacks'
  | 'railpack'
  | 'image'

export interface BuildConfig {
  strategy?: BuildStrategy
  web?: string
  cmd?: string[]
  envs?: Record<string, string>
  dbMigrate?: string[]
  maintenanceActions?: MaintenanceActionConfig[]
  composePath?: string
  setupSteps?: SetupStep[]
  buildCommand?: string
  startCommand?: string
  runtimeVersion?: string
  rootDir?: string
  // 'heroku' | 'paketo' preset, or any CNB builder image reference.
  builder?: string
  buildpacks?: string[]
  image?: string
  port?: number
  cpuLimit?: number
  memoryMb?: number
  volumes?: VolumeConfig[]
}

// A named volume that survives redeploys, scoped per environment by the worker.
export interface VolumeConfig {
  name: string
  path: string
}

export type NotificationKind = 'SLACK' | 'DISCORD' | 'WEBHOOK'

// The stored webhook URL is a credential and is never returned by the API.
export interface NotificationChannel {
  id: string
  name: string
  kind: NotificationKind
  enabled: boolean
  events: string[]
  createdAt: string
}

export interface CreateNotificationChannelInput {
  name: string
  kind: NotificationKind
  url: string
  enabled?: boolean
  events?: string[]
}

export interface UpdateNotificationChannelInput {
  name?: string
  url?: string
  enabled?: boolean
  events?: string[]
}

// A volume as it actually exists in Docker. sizeBytes is -1 when Docker could
// not report a size, so the UI shows "unknown" rather than a misleading 0.
export interface VolumeInfo {
  name: string
  volume: string
  sizeBytes: number
  createdAt: string
  inUse: boolean
}

// Ordered shell commands that run after clone, before build, to generate a
// project's compose/.env. A failed step fails the deploy.
export interface SetupStep {
  command: string
  image?: string
  docker?: boolean
}

// A maintenance action as stored in buildConfig — includes the server-side
// `command`. The public deployment endpoint returns MaintenanceActionDef, which
// omits the command (the client triggers by id only).
export interface MaintenanceActionConfig {
  id: string
  label: string
  service: string
  command: string
  destructive?: boolean
}

export interface Environment {
  id: string
  projectId: string
  name: string
  type: EnvironmentType
  branch: string | null
  subdomain: string
  customDomain: string | null
  prNumber: number | null
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  ownerId: string
  // Org that currently owns the project; re-anchored by a transfer.
  organizationId: string
  name: string
  slug: string
  subdomain: string
  repoUrl: string
  defaultBranch: string
  providerRepoFullName: string | null
  buildConfig: BuildConfig
  createdAt: string
  updatedAt: string
  deletedAt: string | null
  environments?: Environment[]
  // only present on GET /projects/:id (decrypted)
  webhookSecret?: string
}

export interface DeploymentStage {
  id: string
  deploymentId: string
  name: string
  status: DeploymentStageStatus
  ordinal: number
  attempt: number
  maxAttempts: number
  startedAt: string | null
  finishedAt: string | null
  errorJson: Record<string, unknown> | null
}

export interface Service {
  id: string
  deploymentId: string
  name: string
  image: string | null
  containerId: string | null
  host: string | null
  port: number | null
  isWeb: boolean
  status: string | null
}

export interface ServiceStats {
  service: string
  cpuPct: number
  memUsedBytes: number
  memLimitBytes: number
  // Cumulative byte counters since container start (not rates).
  netRxBytes: number
  netTxBytes: number
  blkReadBytes: number
  blkWriteBytes: number
}

// The TRUE container state inspected from the runtime, independent of the DB
// `service.status` (which can be stale). `state: "missing"` = no such container;
// `health: "none"` = the image declares no HEALTHCHECK.
export interface ServiceHealth {
  service: string
  state: 'running' | 'exited' | 'created' | 'restarting' | 'paused' | 'dead' | 'missing'
  health: 'healthy' | 'unhealthy' | 'starting' | 'none'
  restartCount: number
  exitCode: number
}

export interface RepoBranch {
  name: string
  sha: string
}

export interface BranchMeta {
  aheadBy: number | null
  behindBy: number | null
  lastCommitDate: string | null
}

// The branches endpoint returns name + sha, plus the BranchMeta fields when a
// `base` is supplied (deltas relative to that source branch). Without a base,
// the meta fields are absent — hence Partial.
export type RepoBranchWithMeta = RepoBranch & Partial<BranchMeta>

export type DeploymentBranchRole = 'SOURCE' | 'MERGE'

export interface DeploymentBranch {
  id: string
  deploymentId: string
  role: DeploymentBranchRole
  name: string
  sha: string | null
  ordinal: number
}

export interface Deployment {
  id: string
  environmentId: string
  triggeredByUserId: string | null
  status: DeploymentStatus
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  startedAt: string | null
  finishedAt: string | null
  lastHeartbeatAt: string | null
  cancelRequestedAt: string | null
  errorSummary: string | null
  createdAt: string
  url: string
  branches?: DeploymentBranch[]
  stages?: DeploymentStage[]
  services?: Service[]
  environment?: Environment
}

export interface DeploymentListItem {
  id: string
  environmentId: string
  status: DeploymentStatus
  commitSha: string | null
  commitMessage: string | null
  commitAuthor: string | null
  createdAt: string
  url: string
  branches: DeploymentBranch[]
  environment: {
    id: string
    name: string
    subdomain: string
    customDomain: string | null
    project: {
      id: string
      name: string
      subdomain: string
      owner: { username: string }
    }
  }
}

export interface DeploymentListPage {
  items: DeploymentListItem[]
  nextCursor: string | null
}

export interface ListDeploymentsParams {
  limit?: number
  cursor?: string
  status?: DeploymentStatus
  projectId?: string
  orgId?: string
}

export interface ManagedDatabase {
  id: string
  environmentId: string
  type: DatabaseType
  version: string
  name: string
  status: DatabaseStatus
  ownsContainer: boolean
  host: string | null
  port: number | null
  errorSummary: string | null
  createdAt: string
  updatedAt: string
}

export interface DatabaseSnapshot {
  id: string
  databaseId: string
  status: SnapshotStatus
  storageKey: string | null
  sizeBytes: string | null
  errorSummary: string | null
  label: string | null
  // The state `POST /environments/:id/reset` returns this database to.
  isBaseline: boolean
  // Taken by a BackupSchedule rather than a person. Only these are pruned by
  // retention.
  automatic: boolean
  createdAt: string
}

export interface EnvironmentResetResult {
  restored: { database: string; snapshotId: string }[]
  skipped: { database: string; reason: string }[]
}

export interface DatabaseListItem {
  id: string
  type: DatabaseType
  version: string
  name: string
  status: DatabaseStatus
  ownsContainer: boolean
  host: string | null
  port: number | null
  errorSummary: string | null
  createdAt: string
  updatedAt: string
  environment: {
    id: string
    name: string
    project: {
      id: string
      name: string
      subdomain: string
      owner: { username: string }
    }
  }
}

export interface DatabaseListPage {
  items: DatabaseListItem[]
  nextCursor: string | null
}

export interface ListDatabasesParams {
  limit?: number
  cursor?: string
  status?: DatabaseStatus
  type?: DatabaseType
  projectId?: string
  orgId?: string
}

// `id`/`cursor` are BigInt serialized as opaque strings — never coerce to number.
export interface AuditRow {
  id: string
  action: string
  resourceType: string | null
  resourceId: string | null
  actor: { id: string; email: string } | null
  ip: string | null
  userAgent: string | null
  createdAt: string
  afterJson: Record<string, unknown> | null
}

export interface AuditListPage {
  items: AuditRow[]
  nextCursor: string | null
}

export interface ListAuditParams {
  limit?: number
  cursor?: string
  action?: string
  resourceType?: string
  resourceId?: string
  from?: string
  to?: string
  orgId?: string
}

export interface EnvVar {
  key: string
  value: string
}

export interface SetEnvVarsInput {
  vars?: Record<string, string>
  dotenv?: string
}

export interface ManagedFile {
  path: string
  content: string
  updatedAt: string
}

export interface SaveManagedFileInput {
  path: string
  content: string
}

export interface ProjectFileEntry {
  name: string
  path: string
  type: 'file' | 'dir'
  size: number
  overridden: boolean
}

export interface ProjectFileContent {
  path: string
  content: string
  overridden: boolean
  binary: boolean
  truncated: boolean
}

export interface LoginInput {
  email: string
  password: string
}

export interface SignupInput {
  email: string
  username: string
  password: string
  displayName?: string
}

export interface CreateProjectInput {
  name: string
  repoUrl: string
  subdomain?: string
  defaultBranch?: string
  // Target org for the new project; defaults to the caller's personal org.
  organizationId?: string
}

export interface UpdateProjectInput {
  name?: string
  defaultBranch?: string
  buildConfig?: BuildConfig
}

// A connected Git provider account (GitHub only in v1). Never carries the token.
export interface Connection {
  provider: 'github'
  accountLogin: string
  scopes: string[]
  connectedAt: string
}

export interface RepoSummary {
  fullName: string
  name: string
  owner: string
  private: boolean
  defaultBranch: string
  description: string | null
  language: string | null
  pushedAt: string
  htmlUrl: string
}

// Seeds the Create-Project dialog when deploying a repo from Integrations.
// `providerRepoFullName` is display-only — the API re-derives it from `repoUrl`.
export interface ProjectPrefill {
  name: string
  repoUrl: string
  providerRepoFullName?: string
  defaultBranch?: string
}

export type CreateDatabaseInput =
  | { mode: 'attach-existing'; databaseId: string }
  | {
      mode: 'create-empty'
      type: DatabaseType
      version: string
      name: string
      runMigrate?: boolean
    }
  | { mode: 'copy'; sourceDatabaseId: string; name: string }
  | { mode: 'create-from-snapshot'; snapshotId: string; name: string }

export interface CreateDeploymentInput {
  sourceBranch?: string
  mergeBranches?: string[]
}

export interface LogEntry {
  id: string
  line: string
  stage: string | null
}

// A curated maintenance action surfaced on the deployment page. The command
// stays server-side; the client triggers by id only.
export interface MaintenanceActionDef {
  id: string
  label: string
  service: string
  destructive: boolean
}

export interface OutboxEvent<T = Record<string, unknown>> {
  id: string
  payload: T
}

// ── scheduled tasks ─────────────────────────────────────────────────────────
export type TaskOverlapPolicy = 'SKIP' | 'QUEUE'
export type TaskRunStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
export type TaskRunTrigger = 'SCHEDULE' | 'MANUAL'

export interface TaskRun {
  id: string
  taskId: string
  deploymentId: string | null
  status: TaskRunStatus
  trigger: TaskRunTrigger
  exitCode: number | null
  output: string | null
  errorSummary: string | null
  startedAt: string
  finishedAt: string | null
}

export interface ScheduledTask {
  id: string
  environmentId: string
  name: string
  service: string
  command: string
  schedule: string
  timezone: string
  enabled: boolean
  timeoutSec: number
  overlap: TaskOverlapPolicy
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
  updatedAt: string
  // Only the most recent run, included on the list endpoint.
  runs?: Pick<
    TaskRun,
    'id' | 'status' | 'exitCode' | 'startedAt' | 'finishedAt' | 'errorSummary'
  >[]
}

export interface CreateScheduledTaskInput {
  name: string
  service: string
  command: string
  schedule: string
  timezone?: string
  enabled?: boolean
  timeoutSec?: number
  overlap?: TaskOverlapPolicy
}

export type UpdateScheduledTaskInput = Partial<CreateScheduledTaskInput>

export interface TaskRunOutcome {
  runId: string
  status: 'SUCCEEDED' | 'FAILED' | 'SKIPPED'
  exitCode: number | null
}

export interface ScheduledTaskListItem extends ScheduledTask {
  environment: {
    id: string
    name: string
    project: { id: string; name: string }
  }
}

export interface ListScheduledTasksParams {
  projectId?: string
  enabled?: boolean
  orgId?: string
}

export interface TemplateEnvField {
  key: string
  label: string
  description?: string
  default?: string
  required?: boolean
  secret?: boolean
}

export interface TemplateSummary {
  slug: string
  name: string
  description: string
  category: string
  website?: string
  image: string
  port: number
  volumeCount: number
  promptedEnv: TemplateEnvField[]
  generatedEnvCount: number
  postInstall?: string
}

export interface InstantiateTemplateInput {
  name?: string
  organizationId?: string
  subdomain?: string
  env?: Record<string, string>
  deploy?: boolean
}

export interface InstantiateTemplateResult {
  project: Project
  environmentId: string
  url: string
  deploymentId: string | null
  postInstall?: string
}

export interface DomainStatus {
  customDomain: string | null
  target: string | null
  mode: 'local' | 'server'
}

export interface DomainCheck {
  domain: string
  resolves: boolean
  matches: boolean
  found: string[]
  expected: string[]
  note?: string
}

export type VolumeBackupStatus = 'PENDING' | 'READY' | 'FAILED'

export interface VolumeBackup {
  id: string
  environmentId: string
  volumeName: string
  status: VolumeBackupStatus
  sizeBytes: number | null
  errorSummary: string | null
  label: string | null
  automatic: boolean
  createdAt: string
  completedAt: string | null
}

export type BackupTargetKind = 'DATABASE' | 'VOLUME'

export interface BackupSchedule {
  id: string
  kind: BackupTargetKind
  environmentId: string
  databaseId: string | null
  volumeName: string | null
  schedule: string
  timezone: string
  enabled: boolean
  keepLast: number
  lastRunAt: string | null
  nextRunAt: string | null
  createdAt: string
}

export interface CreateBackupScheduleInput {
  kind: BackupTargetKind
  databaseId?: string
  volumeName?: string
  schedule: string
  timezone?: string
  keepLast?: number
  enabled?: boolean
}

export interface UpdateBackupScheduleInput {
  schedule?: string
  timezone?: string
  keepLast?: number
  enabled?: boolean
}

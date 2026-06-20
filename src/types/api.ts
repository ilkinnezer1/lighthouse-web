// Enums are string unions (tsconfig `erasableSyntaxOnly` forbids TS `enum`).
export type UserRole = 'USER' | 'ADMIN'

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

export interface BuildConfig {
  strategy?: 'dockerfile' | 'compose' | 'sandbox-yml'
  web?: string
  cmd?: string[]
  envs?: Record<string, string>
  dbMigrate?: string[]
  maintenanceActions?: MaintenanceActionConfig[]
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
  createdAt: string
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
}

export interface EnvVar {
  key: string
  value: string
}

export interface SetEnvVarsInput {
  vars?: Record<string, string>
  dotenv?: string
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
}

export interface UpdateProjectInput {
  name?: string
  defaultBranch?: string
  buildConfig?: BuildConfig
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

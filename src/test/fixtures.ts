import type {
  Deployment,
  DeploymentBranch,
  DeploymentStage,
  Environment,
  Project,
  Service,
} from '@/types/api'

export const environment: Environment = {
  id: 'env-1',
  projectId: 'proj-1',
  name: 'staging',
  type: 'PREVIEW',
  branch: 'main',
  subdomain: 'staging-acme',
  customDomain: null,
  prNumber: null,
  active: true,
  createdAt: '2026-08-11T10:00:00.000Z',
  updatedAt: '2026-08-11T10:00:00.000Z',
}

export const project: Project = {
  id: 'proj-1',
  ownerId: 'user-1',
  organizationId: 'org-1',
  name: 'Acme',
  slug: 'acme',
  subdomain: 'acme',
  repoUrl: 'https://github.com/acme/app',
  defaultBranch: 'main',
  providerRepoFullName: 'acme/app',
  buildConfig: {},
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
  deletedAt: null,
}

export function makeStage(over: Partial<DeploymentStage> = {}): DeploymentStage {
  return {
    id: 'stage-1',
    deploymentId: 'dep-1',
    name: 'build',
    status: 'SUCCEEDED',
    ordinal: 1,
    attempt: 1,
    maxAttempts: 1,
    startedAt: '2026-08-11T12:00:00.000Z',
    finishedAt: '2026-08-11T12:00:30.000Z',
    errorJson: null,
    ...over,
  }
}

export function makeService(over: Partial<Service> = {}): Service {
  return {
    id: 'svc-1',
    deploymentId: 'dep-1',
    name: 'web',
    image: 'acme/app:latest',
    containerId: 'container-1',
    host: 'acme-staging',
    port: 3000,
    isWeb: true,
    status: 'running',
    ...over,
  }
}

export function makeBranch(over: Partial<DeploymentBranch> = {}): DeploymentBranch {
  return {
    id: 'br-1',
    deploymentId: 'dep-1',
    role: 'SOURCE',
    name: 'main',
    sha: 'abcdef1234567890',
    ordinal: 0,
    ...over,
  }
}

export function makeDeployment(over: Partial<Deployment> = {}): Deployment {
  return {
    id: 'dep-1',
    environmentId: 'env-1',
    triggeredByUserId: 'user-1',
    status: 'SUCCEEDED',
    commitSha: 'abcdef1234567890',
    commitMessage: 'Add the thing',
    commitAuthor: 'Ada',
    startedAt: '2026-08-11T12:00:00.000Z',
    finishedAt: '2026-08-11T12:01:30.000Z',
    lastHeartbeatAt: null,
    cancelRequestedAt: null,
    errorSummary: null,
    createdAt: '2026-08-11T12:00:00.000Z',
    url: 'https://staging-acme.example.test',
    environment,
    ...over,
  }
}

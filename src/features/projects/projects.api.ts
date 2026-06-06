import { api } from '@/lib/api'
import type {
  CreateProjectInput,
  Project,
  RepoBranchWithMeta,
  UpdateProjectInput,
} from '@/types/api'

export async function listProjects() {
  const { data } = await api.get<Project[]>('/projects')
  return data
}

export async function getProject(id: string) {
  const { data } = await api.get<Project>(`/projects/${id}`)
  return data
}

export async function createProject(input: CreateProjectInput) {
  const { data } = await api.post<Project>('/projects', input)
  return data
}

export async function updateProject(id: string, input: UpdateProjectInput) {
  const { data } = await api.patch<Project>(`/projects/${id}`, input)
  return data
}

export async function deleteProject(id: string) {
  await api.delete(`/projects/${id}`)
}

export async function listProjectBranches(id: string, base?: string) {
  const { data } = await api.get<RepoBranchWithMeta[]>(
    `/projects/${id}/branches`,
    { params: base ? { base } : undefined },
  )
  return data
}

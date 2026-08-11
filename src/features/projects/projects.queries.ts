import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, ref, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import type { CreateProjectInput, UpdateProjectInput } from '@/types/api'
import {
  createProject,
  deleteProject,
  getProject,
  listProjectBranches,
  listProjects,
  transferProject,
  updateProject,
} from './projects.api'

export const projectKeys = {
  all: ['projects'] as const,
  list: (orgId: string | null) => ['projects', 'list', orgId] as const,
  detail: (id: string) => ['projects', id] as const,
  branches: (id: string, base?: string) => ['projects', id, 'branches', base ?? null] as const,
}

export function useProjects() {
  const active = useActiveOrgStore()
  return useQuery({
    queryKey: computed(() => projectKeys.list(active.activeOrgId)),
    queryFn: () => listProjects(active.activeOrgId ?? undefined),
  })
}

export function useProject(id: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => projectKeys.detail(toValue(id))),
    queryFn: () => getProject(toValue(id)),
  })
}

export function useProjectBranches(
  id: MaybeRefOrGetter<string>,
  opts?: {
    base?: MaybeRefOrGetter<string | undefined>
    enabled?: MaybeRefOrGetter<boolean>
  },
) {
  const qc = useQueryClient()
  const query = useQuery({
    queryKey: computed(() => projectKeys.branches(toValue(id), toValue(opts?.base) || undefined)),
    queryFn: () => listProjectBranches(toValue(id), toValue(opts?.base) || undefined),
    enabled: computed(() => (opts?.enabled === undefined ? true : toValue(opts.enabled))),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })

  const isRefreshing = ref(false)
  async function refresh() {
    const projectId = toValue(id)
    const base = toValue(opts?.base) || undefined
    isRefreshing.value = true
    try {
      const data = await listProjectBranches(projectId, base, true)
      qc.setQueryData(projectKeys.branches(projectId, base), data)
      return data
    } finally {
      isRefreshing.value = false
    }
  }

  return Object.assign(query, { refresh, isRefreshing })
}

export function useCreateProject() {
  const qc = useQueryClient()
  const active = useActiveOrgStore()
  return useMutation({
    // Land the project in the active org (the API defaults to personal when absent).
    mutationFn: (input: CreateProjectInput) =>
      createProject({
        ...input,
        organizationId: input.organizationId ?? active.activeOrgId ?? undefined,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useUpdateProject(id: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(toValue(id), input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(toValue(id)) })
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

export function useDeleteProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useTransferProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ projectId, organizationId }: { projectId: string; organizationId: string }) =>
      transferProject(projectId, organizationId),
    onSuccess: (_project, { projectId }) => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) })
      // Refresh both the source and destination org project lists.
      void qc.invalidateQueries({ queryKey: projectKeys.all })
    },
  })
}

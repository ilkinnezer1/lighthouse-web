import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import type { CreateProjectInput, UpdateProjectInput } from '@/types/api'
import {
  createProject,
  deleteProject,
  getProject,
  listProjectBranches,
  listProjects,
  updateProject,
} from './projects.api'

export const projectKeys = {
  all: ['projects'] as const,
  detail: (id: string) => ['projects', id] as const,
  branches: (id: string, base?: string) =>
    ['projects', id, 'branches', base ?? null] as const,
}

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: listProjects,
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
  return useQuery({
    queryKey: computed(() =>
      projectKeys.branches(toValue(id), toValue(opts?.base) || undefined),
    ),
    queryFn: () =>
      listProjectBranches(toValue(id), toValue(opts?.base) || undefined),
    enabled: computed(() =>
      opts?.enabled === undefined ? true : toValue(opts.enabled),
    ),
    staleTime: 60_000,
    // Keep the prior rows visible while deltas refetch on a source change, so
    // the picker doesn't flash empty.
    placeholderData: keepPreviousData,
  })
}

export function useCreateProject() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateProjectInput) => createProject(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

export function useUpdateProject(id: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: UpdateProjectInput) => updateProject(toValue(id), input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(toValue(id)) })
      qc.invalidateQueries({ queryKey: projectKeys.all })
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

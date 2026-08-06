import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import type { InstantiateTemplateInput } from '@/types/api'
import { projectKeys } from '@/features/projects/projects.queries'
import { instantiateTemplate, listTemplates } from './templates.api'

export const templateKeys = {
  all: ['templates'] as const,
}

export function useTemplates() {
  return useQuery({
    queryKey: templateKeys.all,
    queryFn: listTemplates,
    // The catalog is static and ships with the API build — refetching it on
    // every mount is pure noise.
    staleTime: Infinity,
  })
}

export function useInstantiateTemplate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { slug: string; input: InstantiateTemplateInput }) =>
      instantiateTemplate(vars.slug, vars.input),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  })
}

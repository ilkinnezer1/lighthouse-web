import { api } from '@/lib/api'
import type {
  InstantiateTemplateInput,
  InstantiateTemplateResult,
  TemplateSummary,
} from '@/types/api'

export async function listTemplates() {
  const { data } = await api.get<TemplateSummary[]>('/templates')
  return data
}

export async function instantiateTemplate(slug: string, input: InstantiateTemplateInput) {
  const { data } = await api.post<InstantiateTemplateResult>(
    `/templates/${slug}/instantiate`,
    input,
  )
  return data
}

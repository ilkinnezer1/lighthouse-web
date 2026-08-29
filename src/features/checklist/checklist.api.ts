import { api } from '@/lib/api'
import type {
  CheckItemInput,
  Checklist,
  ChecklistItem,
  CreateChecklistItemInput,
} from '@/types/api'

// Every route that records something goes through a deployment: there is no way
// to tick against an environment, because "it works on staging" expires the
// next time staging moves.

export async function getChecklist(deploymentId: string) {
  const { data } = await api.get<Checklist>(`/deployments/${deploymentId}/checklist`)
  return data
}

/** A write, and only ever on request — the GET above never seeds. */
export async function seedChecklist(deploymentId: string) {
  const { data } = await api.post<Checklist>(`/deployments/${deploymentId}/checklist/seed`)
  return data
}

export async function createChecklistItem(deploymentId: string, input: CreateChecklistItemInput) {
  const { data } = await api.post<ChecklistItem>(
    `/deployments/${deploymentId}/checklist/items`,
    input,
  )
  return data
}

// Environment-scoped, because the item is: deleting it retires the chore
// everywhere, not just off the build that happens to be on screen.
export async function deleteChecklistItem(itemId: string) {
  await api.delete(`/checklist-items/${itemId}`)
}

// PUT, not POST: an item's state on a build is one fact, so re-checking
// replaces it rather than appending a second opinion.
export async function checkItem(deploymentId: string, itemId: string, input: CheckItemInput) {
  const { data } = await api.put<ChecklistItem>(
    `/deployments/${deploymentId}/checklist/items/${itemId}/check`,
    input,
  )
  return data
}

export async function uncheckItem(deploymentId: string, itemId: string) {
  const { data } = await api.delete<ChecklistItem>(
    `/deployments/${deploymentId}/checklist/items/${itemId}/check`,
  )
  return data
}

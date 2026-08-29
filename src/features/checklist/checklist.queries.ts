import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { environmentBoardKeys } from '@/features/environments/environments.queries'
import { findingKeys } from '@/features/findings/findings.queries'
import type { CheckItemInput, Checklist, ChecklistItem } from '@/types/api'
import {
  checkItem,
  createChecklistItem,
  deleteChecklistItem,
  getChecklist,
  seedChecklist,
  uncheckItem,
} from './checklist.api'
import { summarize } from './checklist.progress'

export const checklistKeys = {
  all: ['checklist'] as const,
  byDeployment: (deploymentId: string) => ['checklist', 'deployment', deploymentId] as const,
}

// No polling: a checklist only changes when a person changes it.

export function useChecklist(deploymentId: MaybeRefOrGetter<string>) {
  return useQuery({
    queryKey: computed(() => checklistKeys.byDeployment(toValue(deploymentId))),
    queryFn: () => getChecklist(toValue(deploymentId)),
  })
}

/**
 * The board's per-environment `remaining` is measured against the same build,
 * so it goes stale on every tick. A board that says an environment is fully
 * tested when it is not is worse than a board with no column at all.
 */
function useInvalidateBoard() {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: environmentBoardKeys.all })
  }
}

function useInvalidateChecklist() {
  const qc = useQueryClient()
  const invalidateBoard = useInvalidateBoard()
  return () => {
    void qc.invalidateQueries({ queryKey: checklistKeys.all })
    invalidateBoard()
  }
}

export function useSeedChecklist(deploymentId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  const invalidateBoard = useInvalidateBoard()
  return useMutation({
    mutationFn: () => seedChecklist(toValue(deploymentId)),
    // The seed responds with the whole list, so there is nothing left to fetch.
    onSuccess: (checklist) => {
      qc.setQueryData(checklistKeys.byDeployment(toValue(deploymentId)), checklist)
      invalidateBoard()
    },
  })
}

export function useCreateChecklistItem(deploymentId: MaybeRefOrGetter<string>) {
  const invalidate = useInvalidateChecklist()
  return useMutation({
    mutationFn: (title: string) => createChecklistItem(toValue(deploymentId), { title }),
    onSuccess: invalidate,
  })
}

export function useDeleteChecklistItem() {
  const invalidate = useInvalidateChecklist()
  return useMutation({
    mutationFn: (itemId: string) => deleteChecklistItem(itemId),
    // Refetched rather than spliced: retiring a seeded chore makes it seedable
    // again, and only the server knows that number.
    onSuccess: invalidate,
  })
}

/**
 * Check and uncheck both answer with the item they changed, and neither can
 * change the item set or `seedable` — so the cached list is patched in place
 * and the summary recomputed by the same rule the server used.
 */
function usePatchItem(deploymentId: MaybeRefOrGetter<string>) {
  const qc = useQueryClient()
  return (item: ChecklistItem) => {
    qc.setQueryData<Checklist>(checklistKeys.byDeployment(toValue(deploymentId)), (previous) => {
      if (!previous) return previous
      const items = previous.items.map((row) => (row.id === item.id ? item : row))
      return { ...previous, items, summary: summarize(items) }
    })
  }
}

export function useCheckItem(deploymentId: MaybeRefOrGetter<string>) {
  const patch = usePatchItem(deploymentId)
  const invalidateBoard = useInvalidateBoard()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { itemId: string } & CheckItemInput) =>
      checkItem(toValue(deploymentId), vars.itemId, {
        result: vars.result,
        note: vars.note,
        finding: vars.finding,
      }),
    onSuccess: (item) => {
      patch(item)
      invalidateBoard()
      // A fail can file a finding, which the section next to this one lists.
      if (item.check?.findingId) void qc.invalidateQueries({ queryKey: findingKeys.all })
    },
  })
}

export function useUncheckItem(deploymentId: MaybeRefOrGetter<string>) {
  const patch = usePatchItem(deploymentId)
  const invalidateBoard = useInvalidateBoard()
  return useMutation({
    mutationFn: (itemId: string) => uncheckItem(toValue(deploymentId), itemId),
    onSuccess: (item) => {
      patch(item)
      invalidateBoard()
    },
  })
}

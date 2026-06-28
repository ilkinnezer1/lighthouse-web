import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import { useActiveOrgStore } from '@/features/orgs/active-org.store'
import { useCursorFeed } from '@/lib/feed'
import { listAuditLogs } from './audit.api'

export const auditKeys = {
  all: ['audit'] as const,
}

export function useAuditFeed(filters: {
  action?: MaybeRefOrGetter<string | undefined>
  resourceType?: MaybeRefOrGetter<string | undefined>
  resourceId?: MaybeRefOrGetter<string | undefined>
  from?: MaybeRefOrGetter<string | undefined>
  to?: MaybeRefOrGetter<string | undefined>
}) {
  const active = useActiveOrgStore()
  return useCursorFeed({
    queryKey: computed(() => [
      ...auditKeys.all,
      'feed',
      active.activeOrgId,
      toValue(filters.action) ?? null,
      toValue(filters.resourceType) ?? null,
      toValue(filters.resourceId) ?? null,
      toValue(filters.from) ?? null,
      toValue(filters.to) ?? null,
    ]),
    fetchPage: (cursor) =>
      listAuditLogs({
        cursor,
        orgId: active.activeOrgId ?? undefined,
        action: toValue(filters.action),
        resourceType: toValue(filters.resourceType),
        resourceId: toValue(filters.resourceId),
        from: toValue(filters.from),
        to: toValue(filters.to),
        limit: 30,
      }),
  })
}

import { computed, type MaybeRefOrGetter, toValue } from 'vue'
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
  return useCursorFeed({
    queryKey: computed(() => [
      ...auditKeys.all,
      'feed',
      toValue(filters.action) ?? null,
      toValue(filters.resourceType) ?? null,
      toValue(filters.resourceId) ?? null,
      toValue(filters.from) ?? null,
      toValue(filters.to) ?? null,
    ]),
    fetchPage: (cursor) =>
      listAuditLogs({
        cursor,
        action: toValue(filters.action),
        resourceType: toValue(filters.resourceType),
        resourceId: toValue(filters.resourceId),
        from: toValue(filters.from),
        to: toValue(filters.to),
        limit: 30,
      }),
  })
}

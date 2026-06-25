import { api } from '@/lib/api'
import type { AuditListPage, ListAuditParams } from '@/types/api'

export async function listAuditLogs(params?: ListAuditParams) {
  const { data } = await api.get<AuditListPage>('/audit-logs', { params })
  return data
}

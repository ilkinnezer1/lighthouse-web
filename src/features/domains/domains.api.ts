import { api } from '@/lib/api'
import type { DomainCheck, DomainStatus } from '@/types/api'

export async function getDomain(envId: string) {
  const { data } = await api.get<DomainStatus>(`/environments/${envId}/domain`)
  return data
}

export async function setDomain(envId: string, domain: string) {
  const { data } = await api.put<DomainStatus>(`/environments/${envId}/domain`, {
    domain,
  })
  return data
}

export async function clearDomain(envId: string) {
  await api.delete(`/environments/${envId}/domain`)
}

export async function checkDomain(envId: string) {
  const { data } = await api.get<DomainCheck>(`/environments/${envId}/domain/check`)
  return data
}

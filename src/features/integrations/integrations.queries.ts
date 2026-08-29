import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  createGitCredential,
  deleteGitCredential,
  disconnectAtlassian,
  disconnectGithub,
  getIntegrations,
  isNotConnected,
  listRepos,
} from './integrations.api'

export const integrationKeys = {
  all: ['integrations'] as const,
  overview: ['integrations', 'connections'] as const,
  repos: (search: string) => ['integrations', 'repos', search] as const,
}

export function useIntegrations() {
  return useQuery({
    queryKey: integrationKeys.overview,
    queryFn: getIntegrations,
  })
}

/**
 * Reads the same overview the page already fetched rather than calling
 * `GET /integrations/git-credentials` a second time — vue-query dedupes on the
 * key, so a second component asking costs no request.
 */
export function useGitCredentials() {
  const query = useIntegrations()
  const credentials = computed(() => query.data.value?.gitCredentials ?? [])
  return Object.assign(query, { credentials })
}

// Narrow on purpose: the token list rides the overview, and invalidating the
// whole `integrations` tree would re-run the repo search against GitHub too.
export function useCreateGitCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: createGitCredential,
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.overview }),
  })
}

export function useDeleteGitCredential() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: deleteGitCredential,
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.overview }),
  })
}

export function useRepoBrowser(opts: {
  search: MaybeRefOrGetter<string>
  enabled?: MaybeRefOrGetter<boolean>
}) {
  const search = computed(() => toValue(opts.search).trim())
  const query = useInfiniteQuery({
    queryKey: computed(() => integrationKeys.repos(search.value)),
    queryFn: ({ pageParam }) => listRepos({ search: search.value, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => last.nextPage,
    enabled: computed(() => (opts.enabled === undefined ? true : toValue(opts.enabled))),
    placeholderData: keepPreviousData,
    // 428 = not connected; retrying won't help. Otherwise default backoff.
    retry: (count, error) => !isNotConnected(error) && count < 2,
  })
  const items = computed(() => query.data.value?.pages.flatMap((p) => p.items) ?? [])
  const notConnected = computed(() => isNotConnected(query.error.value))
  return Object.assign(query, { items, notConnected })
}

export function useDisconnectGithub() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: disconnectGithub,
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.all }),
  })
}

export function useDisconnectAtlassian() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: disconnectAtlassian,
    onSuccess: () => qc.invalidateQueries({ queryKey: integrationKeys.all }),
  })
}

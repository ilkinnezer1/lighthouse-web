import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/vue-query'
import { computed, type MaybeRefOrGetter, toValue } from 'vue'
import {
  disconnectGithub,
  getConnections,
  isNotConnected,
  listRepos,
} from './integrations.api'

export const integrationKeys = {
  all: ['integrations'] as const,
  connections: ['integrations', 'connections'] as const,
  repos: (search: string) => ['integrations', 'repos', search] as const,
}

export function useConnections() {
  return useQuery({
    queryKey: integrationKeys.connections,
    queryFn: getConnections,
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

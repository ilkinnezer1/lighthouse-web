import { useInfiniteQuery } from '@tanstack/vue-query'
import {
  computed,
  type ComputedRef,
  type MaybeRefOrGetter,
  ref,
  type Ref,
  toValue,
} from 'vue'

export function useCursorFeed<T>(opts: {
  queryKey: MaybeRefOrGetter<readonly unknown[]>
  fetchPage: (cursor: string | undefined) => Promise<{ items: T[]; nextCursor: string | null }>
}) {
  const query = useInfiniteQuery({
    queryKey: computed(() => toValue(opts.queryKey)),
    queryFn: ({ pageParam }) => opts.fetchPage((pageParam as string) || undefined),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
  const items = computed(() => query.data.value?.pages.flatMap((p) => p.items) ?? [])
  return Object.assign(query, { items })
}

export function useSelectFilter<T extends string>(): [Ref<T | 'all'>, ComputedRef<T | undefined>] {
  const model = ref('all') as Ref<T | 'all'>
  const param = computed(() => (model.value === 'all' ? undefined : (model.value as T)))
  return [model, param]
}

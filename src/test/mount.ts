import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import {
  mount,
  flushPromises,
  type ComponentMountingOptions,
  type VueWrapper,
} from '@vue/test-utils'
import { createPinia } from 'pinia'
import { defineComponent, h, nextTick, type Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

const RouteStub = defineComponent({ name: 'RouteStub', render: () => h('div') })

// Mirrors the names DeploymentDetailView and its breadcrumb navigate to.
export function createTestRouter(): Router {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'dashboard', component: RouteStub },
      { path: '/projects/:id', name: 'project', component: RouteStub },
      { path: '/projects/:projectId/env/:envId', name: 'environment', component: RouteStub },
      { path: '/deployments/:id', name: 'deployment', component: RouteStub, props: true },
    ],
  })
}

export interface MountAppOptions {
  props?: Record<string, unknown>
  initialRoute?: string
  stubs?: NonNullable<ComponentMountingOptions<unknown>['global']>['stubs']
  // Swallows scheduler errors (e.g. Vue's recursive-update guard) so a test can
  // assert on them instead of letting them escape as unhandled rejections.
  onError?: (err: unknown) => void
}

export interface MountedApp {
  wrapper: VueWrapper
  router: Router
  queryClient: QueryClient
}

export async function mountApp(
  component: Component,
  options: MountAppOptions = {},
): Promise<MountedApp> {
  const router = createTestRouter()
  await router.push(options.initialRoute ?? '/')
  await router.isReady()

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  })

  const wrapper = mount(component, {
    props: options.props,
    attachTo: document.body,
    global: {
      plugins: [createPinia(), router, [VueQueryPlugin, { queryClient }]],
      stubs: options.stubs,
      config: options.onError ? { errorHandler: options.onError } : undefined,
    },
  })

  return { wrapper, router, queryClient }
}

// vue-query resolves over several microtask hops before the DOM catches up.
export async function settle(rounds = 3): Promise<void> {
  for (let i = 0; i < rounds; i++) {
    await flushPromises()
    await nextTick()
  }
}

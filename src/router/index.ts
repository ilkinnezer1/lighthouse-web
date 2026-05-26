import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/features/auth/auth.store'

declare module 'vue-router' {
  interface RouteMeta {
    public?: boolean
  }
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('@/features/auth/LoginView.vue'),
    meta: { public: true },
  },
  {
    path: '/signup',
    name: 'signup',
    component: () => import('@/features/auth/SignupView.vue'),
    meta: { public: true },
  },
  {
    path: '/',
    component: () => import('@/layouts/AppLayout.vue'),
    children: [
      {
        path: '',
        name: 'dashboard',
        component: () => import('@/features/projects/ProjectsView.vue'),
      },
      {
        path: 'projects/:id',
        name: 'project',
        component: () => import('@/features/projects/ProjectDetailView.vue'),
        props: true,
      },
      {
        path: 'projects/:projectId/env/:envId',
        name: 'environment',
        component: () => import('@/features/deployments/EnvironmentView.vue'),
        props: true,
      },
      {
        path: 'projects/:projectId/env/:envId/databases/:databaseId',
        name: 'database',
        component: () => import('@/features/databases/DatabaseDetailView.vue'),
        props: true,
      },
      {
        path: 'deployments/:id',
        name: 'deployment',
        component: () => import('@/features/deployments/DeploymentDetailView.vue'),
        props: true,
      },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  if (!auth.ready) await auth.fetchMe()

  if (to.meta.public) {
    return auth.isAuthenticated ? { name: 'dashboard' } : true
  }
  if (!auth.isAuthenticated) {
    return {
      name: 'login',
      query: to.fullPath !== '/' ? { redirect: to.fullPath } : undefined,
    }
  }
  return true
})

export default router

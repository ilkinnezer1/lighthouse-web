import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query'
import './style.css'
import App from './App.vue'
import router from './router'
import { setUnauthorizedHandler } from '@/lib/api'
import { initTheme } from '@/lib/theme'
import { useAuthStore } from '@/features/auth/auth.store'

initTheme()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false, staleTime: 30_000 },
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueQueryPlugin, { queryClient })

setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.clear()
  if (!router.currentRoute.value.meta.public) {
    router.replace({
      name: 'login',
      query: { redirect: router.currentRoute.value.fullPath },
    })
  }
})

app.mount('#app')

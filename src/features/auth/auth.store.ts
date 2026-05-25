import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { api } from '@/lib/api'
import type { LoginInput, SignupInput, User } from '@/types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const ready = ref(false)

  const isAuthenticated = computed(() => user.value !== null)

  async function fetchMe() {
    try {
      const { data } = await api.get<User>('/auth/me', { skipAuthRedirect: true })
      user.value = data
    } catch {
      user.value = null
    } finally {
      ready.value = true
    }
  }

  async function login(input: LoginInput) {
    const { data } = await api.post<User>('/auth/login', input, { skipAuthRedirect: true })
    user.value = data
    return data
  }

  async function signup(input: SignupInput) {
    const { data } = await api.post<User>('/auth/signup', input, { skipAuthRedirect: true })
    user.value = data
    return data
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } finally {
      user.value = null
    }
  }

  function clear() {
    user.value = null
  }

  return { user, ready, isAuthenticated, fetchMe, login, signup, logout, clear }
})

import { ref, computed } from 'vue'

export type ThemePref = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'lighthouse.theme'

function systemPrefersDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function readStored(): ThemePref {
  const v = localStorage.getItem(STORAGE_KEY)
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
}

const pref = ref<ThemePref>('system')

function paint(p: ThemePref) {
  const dark = p === 'dark' || (p === 'system' && systemPrefersDark())
  document.documentElement.classList.toggle('dark', dark)
}

/**
 * Call before mount so the first paint already carries the right class —
 * otherwise a stored dark preference flashes the light canvas first.
 */
export function initTheme() {
  pref.value = readStored()
  paint(pref.value)
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => {
      if (pref.value === 'system') paint('system')
    })
}

export function useTheme() {
  const isDark = computed(
    () => pref.value === 'dark' || (pref.value === 'system' && systemPrefersDark()),
  )

  function set(p: ThemePref) {
    pref.value = p
    localStorage.setItem(STORAGE_KEY, p)
    paint(p)
  }

  function toggle() {
    set(isDark.value ? 'light' : 'dark')
  }

  return { pref, isDark, set, toggle }
}

import { onUnmounted, ref, toValue, watch, watchEffect, type MaybeRefOrGetter } from 'vue'
import type { DeploymentStatus } from '@/types/api'
import { isTerminalStatus } from './deployments.status'

const STORAGE_KEY = 'lighthouse.notifyOnFinish'
const BASE_TITLE = 'Lighthouse'

type Supported = 'unsupported' | 'default' | 'granted' | 'denied'

function permission(): Supported {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * A deploy takes minutes; nobody should have to sit and watch the log pane.
 *
 * While one is running the tab title carries the status, so the answer is
 * visible from any other tab. On finish, an opt-in browser notification fires —
 * permission is only ever requested from an explicit click, never on load.
 */
export function useDeployWatch(opts: {
  status: MaybeRefOrGetter<DeploymentStatus | undefined>
  label: MaybeRefOrGetter<string>
  onFinish?: (status: DeploymentStatus) => void
}) {
  const notifyEnabled = ref(localStorage.getItem(STORAGE_KEY) === '1')
  const permissionState = ref<Supported>(permission())

  function restoreTitle() {
    document.title = BASE_TITLE
  }

  async function enableNotifications() {
    if (permissionState.value === 'unsupported') return
    if (permissionState.value === 'default') {
      permissionState.value = await Notification.requestPermission()
    }
    const on = permissionState.value === 'granted'
    notifyEnabled.value = on
    localStorage.setItem(STORAGE_KEY, on ? '1' : '0')
  }

  function disableNotifications() {
    notifyEnabled.value = false
    localStorage.setItem(STORAGE_KEY, '0')
  }

  function toggleNotifications() {
    if (notifyEnabled.value) disableNotifications()
    else void enableNotifications()
  }

  // The title tracks status AND label, because the project name resolves from a
  // separate query and would otherwise stay stuck at its placeholder.
  watchEffect(() => {
    const status = toValue(opts.status)
    if (!status) {
      restoreTitle()
      return
    }
    document.title = `${symbolFor(status)} ${titleFor(status)} — ${toValue(opts.label)}`
  })

  watch(
    () => toValue(opts.status),
    (status, previous) => {
      if (!status) return

      // Only announce a real transition into a terminal state, so opening an
      // already-finished deployment doesn't fire a notification.
      const justFinished = !!previous && !isTerminalStatus(previous) && isTerminalStatus(status)
      if (!justFinished) return

      opts.onFinish?.(status)

      if (notifyEnabled.value && permissionState.value === 'granted' && document.hidden) {
        new Notification(`${titleFor(status)} — ${toValue(opts.label)}`, {
          body:
            status === 'SUCCEEDED'
              ? 'Your deployment is live.'
              : `Deployment ${titleFor(status).toLowerCase()}.`,
          tag: `lighthouse-deploy`,
        })
      }
    },
  )

  onUnmounted(restoreTitle)

  return { notifyEnabled, permissionState, toggleNotifications }
}

function titleFor(s: DeploymentStatus) {
  return s.charAt(0) + s.slice(1).toLowerCase()
}

function symbolFor(s: DeploymentStatus) {
  if (s === 'SUCCEEDED') return '✓'
  if (s === 'FAILED') return '✕'
  return '•'
}

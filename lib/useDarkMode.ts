'use client'

import { useSyncExternalStore } from 'react'

function isDark() {
  const theme = document.documentElement.dataset.theme
  if (theme === 'dark') return true
  if (theme === 'light') return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

function subscribe(cb: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', cb)
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
  return () => {
    mq.removeEventListener('change', cb)
    obs.disconnect()
  }
}

export function useDarkMode() {
  return useSyncExternalStore(subscribe, isDark, () => false)
}

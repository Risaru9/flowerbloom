// oxlint-disable-next-line import/no-unassigned-import -- mendaftarkan matcher jest-dom (efek samping yang disengaja)
import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
  localStorage.clear()
  sessionStorage.clear()
})

function matchMediaTiruan(query: string): MediaQueryList {
  return {
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  } as MediaQueryList
}

function bukaDialog(this: HTMLDialogElement) {
  this.setAttribute('open', '')
}

function tutupDialog(this: HTMLDialogElement) {
  this.removeAttribute('open')
}

// jsdom belum menyediakan beberapa API peramban yang dipakai aplikasi.
if (!window.matchMedia) window.matchMedia = matchMediaTiruan
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = bukaDialog
  HTMLDialogElement.prototype.close = tutupDialog
}

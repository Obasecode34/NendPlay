import React, { useEffect } from 'react'

const ADSENSE_CLIENT = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT || ''
const DEFAULT_SLOT = import.meta.env.VITE_GOOGLE_ADSENSE_SLOT || ''

let scriptLoaded = false

function loadAdsenseScript() {
  if (!ADSENSE_CLIENT || scriptLoaded || document.querySelector('script[data-nendplay-adsense]')) {
    scriptLoaded = true
    return
  }

  const script = document.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  script.crossOrigin = 'anonymous'
  script.dataset.nendplayAdsense = 'true'
  document.head.appendChild(script)
  scriptLoaded = true
}

export default function GoogleAdSlot({ slot = DEFAULT_SLOT, className = '' }) {
  useEffect(() => {
    loadAdsenseScript()
  }, [])

  useEffect(() => {
    if (!ADSENSE_CLIENT || !slot) return
    try {
      window.adsbygoogle = window.adsbygoogle || []
      window.adsbygoogle.push({})
    } catch {}
  }, [slot])

  if (!ADSENSE_CLIENT || !slot) {
    return (
      <div
        className={`rounded-xl px-4 py-5 text-center text-sm ${className}`}
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
        Google ad slot ready
      </div>
    )
  }

  return (
    <ins
      className={`adsbygoogle block ${className}`}
      style={{ display: 'block', minHeight: 90 }}
      data-ad-client={ADSENSE_CLIENT}
      data-ad-slot={slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  )
}

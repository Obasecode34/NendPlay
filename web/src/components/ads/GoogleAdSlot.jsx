import React, { useEffect, useState } from 'react'
import { adService } from '../../services'

const ADSENSE_CLIENT = import.meta.env.VITE_GOOGLE_ADSENSE_CLIENT
  || import.meta.env.VITE_GOOGLE_AD_CLIENT
  || ''
const DEFAULT_SLOT = import.meta.env.VITE_GOOGLE_ADSENSE_SLOT
  || import.meta.env.VITE_GOOGLE_AD_SLOT
  || ''
const ENABLE_NATIVE_ADS = import.meta.env.VITE_NENDPLAY_NATIVE_ADS !== 'false'
const ENABLE_HOUSE_ADS = import.meta.env.VITE_NENDPLAY_HOUSE_ADS !== 'false'

let scriptLoaded = false

function loadAdsenseScript() {
  const existingScript = document.querySelector('script[data-nendplay-adsense]')
    || document.querySelector('script[src*="pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"]')

  if (!ADSENSE_CLIENT || scriptLoaded || existingScript) {
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

function NendPlayNativeAd({ placement, className }) {
  const [ad, setAd] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    const loadNativeAd = async () => {
      try {
        const res = await adService.serve({ placement, limit: 1 })
        const nextAd = res.data?.data?.nativeAds?.[0]
        if (!cancelled) setAd(nextAd || null)
        if (nextAd?._id) adService.recordImpression(nextAd._id).catch(() => {})
      } catch {
        if (!cancelled) setAd(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadNativeAd()
    return () => {
      cancelled = true
    }
  }, [placement])

  const openAd = async () => {
    if (!ad?._id) return
    try {
      const res = await adService.recordClick(ad._id)
      const targetUrl = res.data?.data?.targetUrl || ad.targetUrl
      if (targetUrl) window.open(targetUrl, '_blank', 'noopener,noreferrer')
    } catch {
      if (ad.targetUrl) window.open(ad.targetUrl, '_blank', 'noopener,noreferrer')
    }
  }

  if (loading) {
    return (
      <div
        className={`h-28 animate-pulse rounded-xl ${className}`}
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
      />
    )
  }

  if (!ad) {
    if (!ENABLE_HOUSE_ADS) return null
    return (
      <a
        href="/advertise"
        className={`block rounded-xl px-4 py-5 text-left transition hover:-translate-y-0.5 ${className}`}
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.18), rgba(14,165,233,0.12))',
          color: 'var(--color-text)',
          border: '1px solid var(--color-border)',
        }}
      >
        <div className="mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
          style={{ background: 'rgba(124,58,237,0.18)', color: 'var(--color-primary)' }}>
          Sponsored
        </div>
        <h3 className="text-base font-black">Advertise on NendPlay</h3>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Reach movie, music, news, and NovelHub audiences across web and mobile.
        </p>
      </a>
    )
  }

  return (
    <button
      type="button"
      onClick={openAd}
      className={`group w-full overflow-hidden rounded-xl text-left transition hover:-translate-y-0.5 ${className}`}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      <div className="grid gap-3 p-3 sm:grid-cols-[160px_1fr] sm:items-center">
        {ad.mediaUrl ? (
          <img
            src={ad.mediaUrl}
            alt={ad.title}
            className="h-28 w-full rounded-lg object-cover sm:h-24"
            loading="lazy"
          />
        ) : null}
        <div className="min-w-0">
          <div className="mb-2 inline-flex rounded-full px-2 py-1 text-[11px] font-bold uppercase tracking-wide"
            style={{ background: 'rgba(124,58,237,0.14)', color: 'var(--color-primary)' }}>
            Sponsored
          </div>
          <h3 className="line-clamp-2 text-base font-bold" style={{ color: 'var(--color-text)' }}>
            {ad.title}
          </h3>
          {ad.description ? (
            <p className="mt-1 line-clamp-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {ad.description}
            </p>
          ) : null}
          {ad.advertiserName ? (
            <p className="mt-2 text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
              {ad.advertiserName}
            </p>
          ) : null}
        </div>
      </div>
    </button>
  )
}

function AdsenseSlot({ slot, className }) {
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

  if (!ADSENSE_CLIENT || !slot) return null

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

export default function GoogleAdSlot({ slot = DEFAULT_SLOT, className = '', placement = 'home' }) {
  const hasGoogleWebAd = Boolean(ADSENSE_CLIENT && slot)

  if (!ENABLE_NATIVE_ADS && !hasGoogleWebAd) return null

  return (
    <div className={`space-y-3 ${className}`}>
      {ENABLE_NATIVE_ADS ? <NendPlayNativeAd placement={placement} className="" /> : null}
      {hasGoogleWebAd ? <AdsenseSlot slot={slot} className="" /> : null}
    </div>
  )
}

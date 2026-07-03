import React, { useEffect, useState } from 'react'
import { RiMegaphoneFill, RiBarChartFill, RiPauseFill, RiPlayFill } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { adService, adminService } from '../services/index'
import useAuthStore from '../stores/authStore'

const AD_TYPES = [
  { value: 'banner', label: 'Banner', desc: 'Static image above/below content' },
  { value: 'video', label: 'Video', desc: 'Short video in sidebar or overlay' },
  { value: 'overlay', label: 'Overlay', desc: 'Semi-transparent overlay on live events' },
]

const PLACEMENTS = [
  { value: 'home', label: 'Home' },
  { value: 'media', label: 'During Media' },
  { value: 'news', label: 'News' },
  { value: 'downloads', label: 'Downloads' },
  { value: 'profile', label: 'Profile' },
  { value: 'subscription', label: 'Subscription' },
  { value: 'live_event', label: 'Live Events' },
  { value: 'shorts', label: 'Shorts' },
  { value: 'novels', label: 'NovelHub' },
  { value: 'all', label: 'Everywhere' },
]

const PAYMENT_GATEWAYS = [
  { key: 'paystack', label: 'Paystack' },
  { key: 'flutterwave', label: 'Flutterwave' },
  { key: 'opay', label: 'OPay' },
  { key: 'palmpay', label: 'PalmPay' },
]

export default function AdvertisePage() {
  const { user } = useAuthStore()
  const [myAds, setMyAds] = useState([])
  const [quote, setQuote] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)
  const [creativeFile, setCreativeFile] = useState(null)
  const [form, setForm] = useState({
    advertiserName: '', title: '', description: '',
    targetUrl: '', adType: 'banner', placement: 'home',
    durationDays: 7, gateway: 'paystack', mediaUrl: '',
  })
  const isAdmin = ['admin', 'super_admin'].includes(user?.role)

  useEffect(() => {
    fetchMyAds()
    const params = new URLSearchParams(window.location.search)
    const ref = params.get('ref')
    const gateway = params.get('gateway')
    if (ref && gateway) {
      verifyPayment(ref, gateway)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (form.adType && form.placement && form.durationDays) {
      fetchQuote()
    }
  }, [form.adType, form.placement, form.durationDays])

  const fetchMyAds = async () => {
    try {
      const res = await adService.getMyAds()
      setMyAds(res.data.data.ads)
    } catch {} finally { setLoading(false) }
  }

  const fetchQuote = async () => {
    try {
      const res = await adService.getPricing({
        adType: form.adType,
        placement: form.placement,
        durationDays: form.durationDays,
      })
      setQuote(res.data.data.quote)
    } catch {}
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      let payload = form
      if (creativeFile) {
        payload = new FormData()
        Object.entries(form).forEach(([key, value]) => payload.append(key, String(value ?? '')))
        payload.append('creative', creativeFile)
      }
      if (isAdmin) {
        await adminService.createAd(payload)
        toast.success('Free admin ad created')
      } else {
        const res = await adService.submit(payload)
        const { paymentUrl } = res.data?.data || {}
        if (!paymentUrl) throw new Error('Payment link was not returned')
        toast.success('Ad submitted. Redirecting to payment.')
        window.location.assign(paymentUrl)
      }
      setShowForm(false)
      setCreativeFile(null)
      fetchMyAds()
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || 'Submission failed')
    } finally { setSubmitting(false) }
  }

  const verifyPayment = async (transactionRef, gateway) => {
    setVerifyingPayment(true)
    try {
      const res = await adService.verify({ transactionRef, gateway })
      toast.success(res.data?.message || 'Ad payment confirmed. Pending admin review.')
      fetchMyAds()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not verify ad payment')
    } finally {
      setVerifyingPayment(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      const res = await adService.toggle(id)
      toast.success(res.data.message)
      fetchMyAds()
    } catch { toast.error('Failed to toggle ad') }
  }

  const STATUS_COLORS = {
    pending_payment: '#F59E0B', pending_review: '#60A5FA',
    active: '#34D399', paused: '#94A3B8',
    expired: '#6B7280', rejected: '#EF4444', failed: '#EF4444',
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl gradient-text">Advertise</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Reach millions of NendPlay users
          </p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary flex items-center gap-2">
          <RiMegaphoneFill /> {isAdmin ? 'Create Free Ad' : 'Create Ad'}
        </button>
      </div>

      {verifyingPayment && (
        <div className="card p-4 mb-5 text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
          Verifying ad payment...
        </div>
      )}

      {/* My ads */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="skeleton rounded-xl h-20" />)}
        </div>
      ) : myAds.length === 0 ? (
        <div className="card p-12 text-center">
          <RiMegaphoneFill className="text-5xl mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--color-text)' }}>
            No ads yet
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            Create your first ad to reach NendPlay users
          </p>
          <button onClick={() => setShowForm(true)} className="btn-primary">
            {isAdmin ? 'Create Free Ad' : 'Create Ad'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {myAds.map((ad) => (
            <div key={ad._id} className="card p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text)' }}>
                    {ad.title}
                  </p>
                  <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: `${STATUS_COLORS[ad.status]}22`, color: STATUS_COLORS[ad.status] }}>
                    {ad.status.replace('_', ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="capitalize">{ad.adType} · {ad.placement}</span>
                  <span>👁 {ad.impressions}</span>
                  <span>🖱 {ad.clicks}</span>
                  {ad.expiryDate && (
                    <span>Expires {new Date(ad.expiryDate).toLocaleDateString()}</span>
                  )}
                </div>
              </div>

              {['active', 'paused'].includes(ad.status) && (
                <button onClick={() => handleToggle(ad._id)}
                  className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
                  style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
                  {ad.status === 'active' ? <RiPauseFill /> : <RiPlayFill />}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create ad modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-lg rounded-2xl p-6 animate-slide-up overflow-y-auto max-h-[90vh]"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

            <h2 className="font-display font-bold text-xl mb-4" style={{ color: 'var(--color-text)' }}>
              {isAdmin ? 'Create Free Admin Ad' : 'Create Ad'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <input type="text" placeholder="Advertiser name *" value={form.advertiserName}
                onChange={(e) => setForm({ ...form, advertiserName: e.target.value })}
                className="input-base" required />
              <input type="text" placeholder="Ad title *" value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="input-base" required />
              <textarea placeholder="Description" value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-base resize-none" rows={2} />
              <input type="url" placeholder="Target URL (where clicks go)" value={form.targetUrl}
                onChange={(e) => setForm({ ...form, targetUrl: e.target.value })}
                className="input-base" />
              <input type="url" placeholder="Ad media URL (image or video)" value={form.mediaUrl}
                onChange={(e) => setForm({ ...form, mediaUrl: e.target.value })}
                className="input-base" />
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Upload creative image/video
                </label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
                  onChange={(e) => setCreativeFile(e.target.files?.[0] || null)}
                  className="input-base"
                />
                {creativeFile && (
                  <button type="button" className="btn-ghost mt-2 px-3 py-1 text-xs" onClick={() => setCreativeFile(null)}>
                    Remove selected file
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Ad Type
                  </label>
                  <select value={form.adType}
                    onChange={(e) => setForm({ ...form, adType: e.target.value })}
                    className="input-base">
                    {AD_TYPES.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                    Placement
                  </label>
                  <select value={form.placement}
                    onChange={(e) => setForm({ ...form, placement: e.target.value })}
                    className="input-base">
                    {PLACEMENTS.map(({ value, label }) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                  Duration: {form.durationDays} days
                </label>
                <input type="range" min={1} max={90} value={form.durationDays}
                  onChange={(e) => setForm({ ...form, durationDays: parseInt(e.target.value) })}
                  className="w-full" style={{ accentColor: 'var(--color-primary)' }} />
              </div>

              {isAdmin && (
                <div
                  className="p-3 rounded-xl text-sm font-bold"
                  style={{
                    background: 'rgba(34,197,94,0.12)',
                    color: '#22C55E',
                    border: '1px solid rgba(34,197,94,0.28)',
                  }}
                >
                  Payment: Free admin ad. No Paystack or Flutterwave payment is required.
                </div>
              )}

              {/* Price quote */}
              {!isAdmin && quote && (
                <div className="p-3 rounded-xl" style={{ background: 'var(--color-surface-high)' }}>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                    Total: ₦{quote.totalNaira?.toLocaleString()}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {quote.breakdown}
                  </p>
                </div>
              )}

              {!isAdmin && (
                <div className="grid grid-cols-2 gap-3">
                  {PAYMENT_GATEWAYS.map((gw) => (
                    <button key={gw.key} type="button" onClick={() => setForm({ ...form, gateway: gw.key })}
                      className="py-2 rounded-xl text-sm transition-all"
                      style={{
                        background: form.gateway === gw.key ? 'var(--color-primary)' : 'var(--color-surface-high)',
                        color: form.gateway === gw.key ? 'white' : 'var(--color-text-muted)',
                      }}>
                      {gw.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-3">
                <button type="button" onClick={() => setShowForm(false)} className="btn-ghost flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary flex-1">
                  {submitting ? 'Submitting...' : isAdmin ? 'Create Free Ad' : 'Submit & Pay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiCheckLine, RiVipCrownFill, RiCalendarLine, RiCloseLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { subscriptionService } from '../services/index'
import useAuthStore from '../stores/authStore'

const PLAN_COLORS = {
  mobile: '#60A5FA',
  basic: '#34D399',
  standard: '#A78BFA',
  premium: '#FBBF24',
}

const PLAN_ICONS = {
  mobile: '📱', basic: '💻', standard: '⭐', premium: '👑'
}

export default function SubscriptionPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [plans, setPlans] = useState([])
  const [currentSub, setCurrentSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(null)
  const [gateway, setGateway] = useState('paystack')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const plansPromise = subscriptionService.getPlans()
      const subPromise = isAuthenticated
        ? subscriptionService.getMySubscription()
        : Promise.resolve({ data: { data: null } })
      const [plansRes, subRes] = await Promise.all([plansPromise, subPromise])
      setPlans(plansRes.data.data.plans)
      setCurrentSub(subRes.data.data)
    } catch { toast.error('Failed to load plans') }
    finally { setLoading(false) }
  }

  const handleSubscribe = async (planId) => {
    if (!isAuthenticated) {
      toast.error('Create an account or sign in before subscribing')
      navigate('/register')
      return
    }
    if (!user?.email) {
      toast.error('Please add an email to your profile first')
      navigate('/profile')
      return
    }
    setSubscribing(planId)
    try {
      const res = await subscriptionService.initialize({ planId, gateway })
      const { paymentUrl } = res.data.data
      window.open(paymentUrl, '_blank')
      toast.success('Complete payment in the new tab, then click Verify below')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to initialize payment')
    } finally { setSubscribing(null) }
  }

  const handleCancel = async () => {
    if (!window.confirm('Cancel your subscription? You keep access until expiry.')) return
    try {
      const res = await subscriptionService.cancel({ reason: 'User requested cancellation' })
      toast.success(res.data.message)
      fetchData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel')
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-2xl h-80" />)}
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-5xl">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="font-display font-black text-4xl mb-3 gradient-text">
          Choose Your Plan
        </h1>
        <p className="text-lg" style={{ color: 'var(--color-text-muted)' }}>
          Unlock unlimited content with a NendPlay subscription
        </p>
      </div>

      {/* Current subscription banner */}
      {currentSub?.isActive && (
        <div className="card p-4 mb-8 flex items-center justify-between"
          style={{ borderColor: PLAN_COLORS[currentSub.plan] }}>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{PLAN_ICONS[currentSub.plan]}</span>
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                Active: {currentSub.plan?.charAt(0).toUpperCase() + currentSub.plan?.slice(1)} Plan
              </p>
              {currentSub.expiryDate && (
                <p className="text-xs flex items-center gap-1 mt-0.5"
                  style={{ color: 'var(--color-text-muted)' }}>
                  <RiCalendarLine />
                  Expires {new Date(currentSub.expiryDate).toLocaleDateString()}
                </p>
              )}
            </div>
          </div>
          <button onClick={handleCancel}
            className="text-sm px-3 py-1.5 rounded-xl flex items-center gap-1 transition-colors"
            style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
            <RiCloseLine /> Cancel
          </button>
        </div>
      )}

      {/* Gateway selector */}
      <div className="flex items-center justify-center gap-3 mb-8">
        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Pay with:</span>
        {['paystack', 'flutterwave'].map((gw) => (
          <button key={gw} onClick={() => setGateway(gw)}
            className="px-4 py-2 rounded-xl text-sm font-medium capitalize transition-all"
            style={{
              background: gateway === gw ? 'var(--color-primary)' : 'var(--color-surface)',
              color: gateway === gw ? 'white' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}>
            {gw}
          </button>
        ))}
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {plans.map((plan) => {
          const isActive = currentSub?.plan === plan.id && currentSub?.isActive
          const color = PLAN_COLORS[plan.id]

          return (
            <div key={plan.id}
              className={`relative rounded-2xl p-5 flex flex-col transition-all duration-200
                ${plan.isMostPopular ? 'scale-105' : ''}`}
              style={{
                background: 'var(--color-surface)',
                border: isActive ? `2px solid ${color}` : `1px solid var(--color-border)`,
                boxShadow: plan.isMostPopular ? `0 8px 40px ${color}33` : 'none',
              }}>

              {/* Most popular badge */}
              {plan.isMostPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold text-white"
                  style={{ background: color }}>
                  Most Popular
                </div>
              )}

              {/* Plan header */}
              <div className="mb-4">
                <span className="text-3xl">{PLAN_ICONS[plan.id]}</span>
                <h3 className="font-display font-bold text-xl mt-2" style={{ color }}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-black text-2xl" style={{ color: 'var(--color-text)' }}>
                    ₦{plan.monthlyPriceNaira?.toLocaleString()}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>/month</span>
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 flex-1 mb-4">
                {[
                  `${plan.maxConcurrentStreams} simultaneous stream${plan.maxConcurrentStreams > 1 ? 's' : ''}`,
                  `${plan.maxDownloadDevices} download device${plan.maxDownloadDevices > 1 ? 's' : ''}`,
                  plan.supportedDevices?.join(', '),
                  'Ad-free experience',
                  'Live events included',
                ].map((feature, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <RiCheckLine className="text-sm mt-0.5 flex-shrink-0" style={{ color }} />
                    <span className="text-xs capitalize" style={{ color: 'var(--color-text-muted)' }}>
                      {feature}
                    </span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              {isActive ? (
                <div className="w-full py-2.5 rounded-xl text-center text-sm font-bold"
                  style={{ background: `${color}22`, color }}>
                  ✓ Current Plan
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={subscribing === plan.id}
                  className="w-full py-2.5 rounded-xl text-sm font-bold text-white transition-all"
                  style={{
                    background: subscribing === plan.id
                      ? 'var(--color-surface-high)'
                      : `linear-gradient(135deg, ${color}, ${color}cc)`,
                    boxShadow: `0 4px 15px ${color}44`,
                  }}>
                  {subscribing === plan.id ? 'Opening payment...' : 'Subscribe'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Live events note */}
      <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
        Live events are included with all plans. Ads shown during live events regardless of plan.
      </p>
    </div>
  )
}

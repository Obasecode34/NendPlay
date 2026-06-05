import React, { useEffect, useState } from 'react'
import { RiGiftFill, RiFileCopyLine, RiCheckLine, RiUserAddLine, RiTrophyFill } from 'react-icons/ri'
import toast from 'react-hot-toast'
import { referralService } from '../services/index'

export default function ReferralPage() {
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [checking, setChecking] = useState(false)

  useEffect(() => { fetchDashboard() }, [])

  const fetchDashboard = async () => {
    try {
      const res = await referralService.getDashboard()
      setDashboard(res.data.data)
    } catch { toast.error('Failed to load referral data') }
    finally { setLoading(false) }
  }

  const handleCopy = () => {
    const link = `${window.location.origin}/register?ref=${dashboard.referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    toast.success('Referral link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCheckReward = async () => {
    setChecking(true)
    try {
      const res = await referralService.checkReward()
      toast.success(res.data.message)
      fetchDashboard()
    } catch { toast.error('Check failed') }
    finally { setChecking(false) }
  }

  if (loading) {
    return (
      <div className="space-y-4 max-w-2xl">
        {[...Array(4)].map((_, i) => <div key={i} className="skeleton rounded-xl h-24" />)}
      </div>
    )
  }

  if (!dashboard) return null

  const referralLink = `${window.location.origin}/register?ref=${dashboard.referralCode}`
  const nextTier = dashboard.nextTier
  const progress = nextTier
    ? Math.min(100, ((dashboard.referralCount % nextTier.referralsNeeded) / nextTier.referralsNeeded) * 100 + (dashboard.referralCount > 0 ? 10 : 0))
    : 100

  return (
    <div className="animate-fade-in max-w-2xl">
      <div className="mb-6">
        <h1 className="font-display font-bold text-3xl gradient-text">Referrals</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
          Invite friends and earn free subscriptions
        </p>
      </div>

      {/* Referral code card */}
      <div className="card p-6 mb-4"
        style={{ background: 'linear-gradient(135deg, var(--color-surface), var(--color-surface-high))' }}>
        <div className="flex items-center gap-2 mb-3">
          <RiGiftFill style={{ color: 'var(--color-primary)' }} />
          <h2 className="font-semibold" style={{ color: 'var(--color-text)' }}>Your Referral Link</h2>
        </div>

        <div className="flex items-center gap-2 p-3 rounded-xl mb-3"
          style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border)' }}>
          <span className="flex-1 text-sm font-mono truncate" style={{ color: 'var(--color-text-muted)' }}>
            {referralLink}
          </span>
          <button onClick={handleCopy}
            className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: copied ? 'var(--color-primary)' : 'var(--color-surface-high)',
              color: copied ? 'white' : 'var(--color-text-muted)',
            }}>
            {copied ? <RiCheckLine /> : <RiFileCopyLine />}
          </button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="font-black text-3xl gradient-text">{dashboard.referralCount}</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Referrals</p>
          </div>
          {nextTier && (
            <div className="flex-1">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>
                <span>{dashboard.referralCount} referred</span>
                <span>{nextTier.referralsNeeded} more for {nextTier.plan}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-high)' }}>
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${progress}%`, background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent))' }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active reward */}
      {dashboard.currentReward && (
        <div className="card p-4 mb-4"
          style={{ borderColor: '#FBBF24', borderWidth: '1px' }}>
          <div className="flex items-center gap-3">
            <RiTrophyFill className="text-2xl text-yellow-400" />
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                🎉 Active Reward: {dashboard.currentReward.plan?.charAt(0).toUpperCase() + dashboard.currentReward.plan?.slice(1)} Plan
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {dashboard.currentReward.daysRemaining} days remaining
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reward tiers */}
      <div className="card p-5 mb-4">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          Reward Tiers
        </h2>
        <div className="space-y-3">
          {dashboard.allTiers?.map((tier) => {
            const unlocked = dashboard.referralCount >= tier.minReferrals
            return (
              <div key={tier.id}
                className="flex items-center justify-between p-3 rounded-xl"
                style={{
                  background: unlocked ? 'var(--color-surface-high)' : 'transparent',
                  border: `1px solid ${unlocked ? 'var(--color-primary)' : 'var(--color-border)'}`,
                  opacity: unlocked ? 1 : 0.6,
                }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                    style={{ background: unlocked ? 'var(--color-primary)' : 'var(--color-surface-high)' }}>
                    {unlocked ? <RiCheckLine className="text-white" /> : tier.minReferrals}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {tier.minReferrals} referrals
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {tier.plan?.charAt(0).toUpperCase() + tier.plan?.slice(1)} plan for {tier.durationDays} days
                    </p>
                  </div>
                </div>
                {unlocked && (
                  <span className="text-xs font-bold px-2 py-1 rounded-lg"
                    style={{ background: 'var(--color-primary)', color: 'white' }}>
                    Unlocked
                  </span>
                )}
              </div>
            )
          })}
        </div>
        <button onClick={handleCheckReward} disabled={checking}
          className="btn-ghost w-full mt-4 text-sm">
          {checking ? 'Checking...' : 'Check for rewards'}
        </button>
      </div>

      {/* Referral history */}
      <div className="card p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--color-text)' }}>
          People You Referred ({dashboard.referrals?.length || 0})
        </h2>
        {dashboard.referrals?.length === 0 ? (
          <div className="text-center py-6">
            <RiUserAddLine className="text-3xl mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              No referrals yet. Share your link to get started!
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dashboard.referrals.map((ref) => (
              <div key={ref.id} className="flex items-center justify-between py-2"
                style={{ borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                    {ref.referredUser?.profileName?.[0]?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      {ref.referredUser?.profileName || ref.referredUser?.username || 'User'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      Joined {new Date(ref.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {ref.rewardGranted && (
                  <span className="text-xs" style={{ color: 'var(--color-primary)' }}>✓ Counted</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

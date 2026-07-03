import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiGiftFill, RiStarFill, RiVipCrownLine, RiShieldCheckLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'
import { rewardService } from '../services/index'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'

const defaultRewards = [
  { id: 'adfree_1d', label: 'Ad-free for 1 day', coins: 5, kind: 'ad_free', days: 1 },
  { id: 'adfree_7d', label: 'Ad-free for 7 days', coins: 15, kind: 'ad_free', days: 7 },
  { id: 'adfree_30d', label: 'Ad-free for 30 days', coins: 45, kind: 'ad_free', days: 30 },
  { id: 'plan_mobile', label: 'Mobile plan', coins: 50, kind: 'plan', plan: 'mobile', days: 30 },
  { id: 'plan_basic', label: 'Basic plan', coins: 60, kind: 'plan', plan: 'basic', days: 30 },
  { id: 'plan_standard', label: 'Standard plan', coins: 70, kind: 'plan', plan: 'standard', days: 30 },
  { id: 'plan_premium', label: 'Premium plan', coins: 80, kind: 'plan', plan: 'premium', days: 30 },
]

const PAYMENT_GATEWAYS = [
  { key: 'paystack', label: 'Paystack' },
  { key: 'flutterwave', label: 'Flutterwave' },
  { key: 'opay', label: 'OPay' },
  { key: 'palmpay', label: 'PalmPay' },
]

function RewardCard({ reward, coins, onRedeem, redeeming }) {
  const unlocked = coins >= reward.coins
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#202020' }}>
      <div className="p-4 text-center">
        <p className="font-bold text-sm" style={{ color: '#D9D9D9' }}>{reward.label}</p>
        <div className="flex items-center justify-center gap-2 mt-2">
          <RiStarFill style={{ color: '#F5C542' }} />
          <span className="text-2xl font-black text-white">{reward.coins}</span>
        </div>
      </div>
      <button
        disabled={!unlocked || redeeming}
        onClick={() => onRedeem(reward)}
        className="w-full py-3 font-black transition-opacity disabled:opacity-60"
        style={{ background: unlocked ? '#F5C542' : '#7A5A00', color: '#111' }}>
        {redeeming ? 'Redeeming...' : unlocked ? 'Redeem' : `${reward.coins - coins} coins left`}
      </button>
    </div>
  )
}

export default function RewardsPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, updateUser } = useAuthStore()
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(true)
  const [redeemingId, setRedeemingId] = useState(null)
  const [paidDays, setPaidDays] = useState(1)
  const [gateway, setGateway] = useState('paystack')
  const [paymentRef, setPaymentRef] = useState('')
  const [paying, setPaying] = useState(false)
  const [verifyingPayment, setVerifyingPayment] = useState(false)

  const coins = status?.coins ?? user?.rewardCoins ?? 0
  const pricePerDay = status?.paidAdFree?.pricePerDayNaira || 99
  const paidTotal = paidDays * pricePerDay
  const rewards = status?.rewards?.length ? status.rewards : defaultRewards
  const adFreeRewards = rewards.filter((reward) => reward.kind === 'ad_free')
  const planRewards = rewards.filter((reward) => reward.kind === 'plan')
  const nextReward = useMemo(() => rewards.find((reward) => coins < reward.coins), [coins, rewards])

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    fetchStatus()
  }, [isAuthenticated])

  const syncUser = (nextStatus) => {
    updateUser({
      rewardCoins: nextStatus.coins,
      adFreeUntil: nextStatus.adFreeUntil,
      isAdFreeActive: nextStatus.isAdFreeActive,
      subscriptionPlan: nextStatus.subscriptionPlan,
      subscriptionExpiry: nextStatus.subscriptionExpiry,
      isSubscriptionActive: Boolean(
        nextStatus.subscriptionPlan &&
        nextStatus.subscriptionPlan !== 'none' &&
        nextStatus.subscriptionExpiry &&
        new Date(nextStatus.subscriptionExpiry) > new Date()
      ),
    })
  }

  const fetchStatus = async () => {
    setLoading(true)
    try {
      const res = await rewardService.getStatus()
      setStatus(res.data.data)
      syncUser(res.data.data)
    } catch {
      toast.error('Could not load reward balance')
    } finally {
      setLoading(false)
    }
  }

  const redeem = async (reward) => {
    if (!window.confirm(`Use ${reward.coins} coins for ${reward.label}? You can keep earning coins instead.`)) return
    setRedeemingId(reward.id)
    try {
      const res = await rewardService.redeem({ rewardId: reward.id })
      setStatus(res.data.data)
      syncUser(res.data.data)
      toast.success(`${reward.label} redeemed`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Redeem failed')
    } finally {
      setRedeemingId(null)
    }
  }

  const buyAdFree = async () => {
    if (!user?.email) {
      toast.error('Please add an email address to your profile before buying ad-free days')
      return
    }
    setPaying(true)
    try {
      const res = await rewardService.initializePaidAdFree({ days: paidDays, gateway })
      const data = res.data.data
      setPaymentRef(data.transactionRef)
      window.location.href = data.paymentUrl
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not start ad-free payment')
    } finally {
      setPaying(false)
    }
  }

  const verifyPaidAdFree = async () => {
    if (!paymentRef.trim()) {
      toast.error('Enter your transaction reference')
      return
    }
    setVerifyingPayment(true)
    try {
      const res = await rewardService.verifyPaidAdFree({ transactionRef: paymentRef.trim(), gateway })
      const nextStatus = res.data.data.status
      setStatus(nextStatus)
      syncUser(nextStatus)
      setPaymentRef('')
      toast.success(`Ad-free active until ${new Date(nextStatus.adFreeUntil).toLocaleDateString()}`)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Payment has not been confirmed yet')
    } finally {
      setVerifyingPayment(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-3xl animate-fade-in">
        <div className="card p-8 text-center">
          <RiGiftFill className="mx-auto text-5xl mb-4" style={{ color: '#F5C542' }} />
          <h1 className="font-display font-black text-3xl" style={{ color: 'var(--color-text)' }}>Reward Coins</h1>
          <p className="mt-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Sign in to save reward coins and redeem ad-free days or free plans.
          </p>
          <div className="flex justify-center gap-3 mt-6">
            <button className="btn-primary" onClick={() => navigate('/login')}>Sign In</button>
            <button className="btn-ghost" onClick={() => navigate('/register')}>Create Account</button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return <div className="max-w-4xl space-y-4">{[...Array(4)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>
  }

  return (
    <div className="max-w-5xl animate-fade-in">
      <div className="rounded-3xl p-6 mb-6" style={{ background: 'linear-gradient(135deg, #3A2B00, #090909)', border: '1px solid rgba(245,197,66,0.35)' }}>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="font-display font-black text-3xl text-white">Get points and get ad free</h1>
            <p className="mt-2 text-sm" style={{ color: '#B8B8B8' }}>
              {status?.isAdFreeActive
                ? `Ad-free active until ${new Date(status.adFreeUntil).toLocaleDateString()}`
                : nextReward
                  ? `${nextReward.coins - coins} more coins to unlock ${nextReward.label}`
                  : 'All rewards are unlocked.'}
            </p>
          </div>
          <div className="rounded-2xl px-5 py-3 flex items-center gap-3" style={{ background: 'rgba(245,197,66,0.18)' }}>
            <RiStarFill className="text-2xl" style={{ color: '#F5C542' }} />
            <span className="text-3xl font-black text-white">{coins}</span>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-6 flex items-start gap-3" style={{ borderColor: 'rgba(245,197,66,0.28)', background: 'rgba(245,197,66,0.08)' }}>
        <RiStarFill className="mt-0.5 flex-shrink-0" style={{ color: '#F5C542' }} />
        <p className="text-sm leading-6" style={{ color: '#D9D0AF' }}>
          Reward coins are optional NendPlay rewards. They have no cash value, cannot be transferred, and are only used for NendPlay ad-free access or plans. Rewarded ads are always optional and NendPlay is responsible for granting rewards.
        </p>
      </div>

      <GoogleAdSlot placement="subscription" className="mb-6" />

      <div className="card p-6 mb-6" style={{ borderColor: 'rgba(245,197,66,0.28)' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>Buy ad-free days</h2>
            <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
              No ads, no coins needed. Choose your days at ₦{pricePerDay.toLocaleString()} per day.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPaidDays((value) => Math.max(1, value - 1))}
              className="w-11 h-11 rounded-full font-black text-xl"
              style={{ background: '#F5C542', color: '#111' }}>
              -
            </button>
            <div className="text-center min-w-28">
              <p className="text-4xl font-black text-white">{paidDays}</p>
              <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>{paidDays === 1 ? 'day' : 'days'}</p>
            </div>
            <button
              onClick={() => setPaidDays((value) => Math.min(365, value + 1))}
              className="w-11 h-11 rounded-full font-black text-xl"
              style={{ background: '#F5C542', color: '#111' }}>
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 mt-5 items-end">
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Payment gateway</p>
            <div className="flex gap-2">
              {PAYMENT_GATEWAYS.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setGateway(item.key)}
                  className="px-4 py-2 rounded-xl text-sm font-black"
                  style={{
                    background: gateway === item.key ? 'rgba(245,197,66,0.18)' : 'var(--color-surface-high)',
                    color: gateway === item.key ? '#F5C542' : 'var(--color-text-muted)',
                    border: `1px solid ${gateway === item.key ? '#F5C542' : 'var(--color-border)'}`,
                  }}>
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>Total</p>
            <p className="text-3xl font-black text-white">₦{paidTotal.toLocaleString()}</p>
          </div>
        </div>

        <button onClick={buyAdFree} disabled={paying} className="w-full mt-5 py-3 rounded-xl font-black"
          style={{ background: '#F5C542', color: '#111' }}>
          {paying ? 'Opening payment...' : 'Pay for ad-free'}
        </button>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3">
          <input
            value={paymentRef}
            onChange={(event) => setPaymentRef(event.target.value)}
            placeholder="Transaction reference after payment"
            className="input-base"
          />
          <button
            onClick={verifyPaidAdFree}
            disabled={verifyingPayment}
            className="px-5 py-3 rounded-xl font-black"
            style={{ background: 'var(--color-surface-high)', color: '#F5C542', border: '1px solid rgba(245,197,66,0.35)' }}>
            {verifyingPayment ? 'Checking...' : 'Activate'}
          </button>
        </div>
      </div>

      <div className="card p-6 mb-6" style={{ background: '#050505', borderColor: 'rgba(245,197,66,0.28)' }}>
        <h2 className="font-display font-black text-2xl text-center mb-6" style={{ color: '#F5C542' }}>Get your Premium benefits</h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            [RiShieldCheckLine, 'No ads'],
            [RiVipCrownLine, 'Plan rewards'],
            [RiGiftFill, 'Downloads'],
          ].map(([Icon, label]) => (
            <div key={label} className="text-center">
              <Icon className="mx-auto text-3xl mb-2" style={{ color: '#F5C542' }} />
              <p className="text-sm font-bold text-white">{label}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {adFreeRewards.map((reward) => (
            <RewardCard key={reward.id} reward={reward} coins={coins} onRedeem={redeem} redeeming={redeemingId === reward.id} />
          ))}
        </div>
      </div>

      <div className="mb-6">
        <h2 className="font-display font-black text-2xl mb-4" style={{ color: 'var(--color-text)' }}>Redeem free plans</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {planRewards.map((reward) => (
            <RewardCard key={reward.id} reward={reward} coins={coins} onRedeem={redeem} redeeming={redeemingId === reward.id} />
          ))}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-display font-black text-xl mb-2" style={{ color: '#F5C542' }}>Complete tasks to get points</h2>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Rewarded ads are available in the mobile app. Watch short ads there to earn 1 or 2 coins, then redeem on mobile or web.
        </p>
      </div>
    </div>
  )
}

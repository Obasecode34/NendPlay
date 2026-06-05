import React, { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { RiEyeLine, RiEyeOffLine, RiArrowRightLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'
import { authService } from '../services/auth.service'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const referralCode = searchParams.get('ref') || ''
  const { setAuth } = useAuthStore()

  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    profileName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    referralCode,
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (form.password !== form.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const payload = {
        email: form.email.trim(),
        profileName: form.profileName,
        username: form.username.trim(),
        password: form.password,
        confirmPassword: form.confirmPassword,
        referralCode: form.referralCode || undefined,
      }

      const res = await authService.register(payload)
      const { user, accessToken } = res.data.data
      setAuth(user, accessToken)
      toast.success('Account created! Welcome to NendPlay 🎉')
      navigate('/home')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'var(--color-bg)' }}>

      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute w-96 h-96 rounded-full opacity-10 animate-pulse-slow"
          style={{ background: 'var(--color-primary)', filter: 'blur(100px)', top: '-10%', right: '-10%' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-10"
          style={{ background: 'var(--color-accent)', filter: 'blur(80px)', bottom: '-5%', left: '-5%' }} />
      </div>

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3 font-display font-black text-2xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', boxShadow: '0 8px 30px var(--glow-color)' }}>
            N
          </div>
          <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
            Create your account
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Join millions on NendPlay
          </p>
        </div>

        <div className="card p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="your@email.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Display Name
              </label>
              <input
                type="text"
                placeholder="Your name"
                value={form.profileName}
                onChange={(e) => setForm({ ...form, profileName: e.target.value })}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Username
              </label>
              <input
                type="text"
                placeholder="your_username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="input-base"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Min. 6 characters"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-base pr-12"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Repeat password"
                  value={form.confirmPassword}
                  onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                  className="input-base pr-12"
                  required
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {showConfirmPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Referral Code <span className="opacity-50">(optional)</span>
              </label>
              <input
                type="text"
                placeholder="NP-XXXXXXXX"
                value={form.referralCode}
                onChange={(e) => setForm({ ...form, referralCode: e.target.value })}
                className="input-base font-mono text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-2">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Create Account <RiArrowRightLine /></>
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
          Already have an account?{' '}
          <Link to="/login" className="font-semibold" style={{ color: 'var(--color-primary)' }}>
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}

import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { RiEyeLine, RiEyeOffLine, RiArrowRightLine, RiKeyLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'
import { authService } from '../services/auth.service'

export default function LoginPage() {
  const navigate = useNavigate()
  const { setAuth } = useAuthStore()
  const [form, setForm] = useState({ identifier: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [resetMode, setResetMode] = useState(false)
  const [resetForm, setResetForm] = useState({ identifier: '', token: '', newPassword: '' })
  const [showResetPassword, setShowResetPassword] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.identifier || !form.password) {
      toast.error('Please fill in all fields')
      return
    }
    setLoading(true)
    try {
      const identifier = form.identifier.trim()
      const res = await authService.login({ identifier, password: form.password })
      const { user, accessToken } = res.data.data
      setAuth(user, accessToken)
      toast.success(`Welcome back, ${user.profileName || user.username}!`)
      navigate(['admin', 'super_admin'].includes(user.role) ? '/admin' : '/home')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    const identifier = resetForm.identifier || form.identifier
    if (!identifier) {
      toast.error('Enter your email address first')
      return
    }

    setLoading(true)
    try {
      const res = await authService.forgotPassword({ identifier })
      const resetToken = res.data?.data?.resetToken
      setResetForm((current) => ({
        ...current,
        identifier,
        token: resetToken || current.token,
      }))
      toast.success(resetToken ? 'Development reset token filled in' : 'Reset instructions prepared')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password recovery failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetForm.token || !resetForm.newPassword) {
      toast.error('Enter the reset token and new password')
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword({
        token: resetForm.token.trim(),
        newPassword: resetForm.newPassword,
      })
      toast.success('Password updated. Please sign in.')
      setForm({ identifier: resetForm.identifier || form.identifier, password: '' })
      setResetForm({ identifier: '', token: '', newPassword: '' })
      setResetMode(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Password reset failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--color-bg)' }}>

      {/* Left — decorative */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden items-center justify-center"
        style={{ background: 'var(--gradient-hero)' }}>
        {/* Glow orbs */}
        <div className="absolute w-96 h-96 rounded-full opacity-20 animate-pulse-slow"
          style={{ background: 'var(--color-primary)', filter: 'blur(80px)', top: '20%', left: '20%' }} />
        <div className="absolute w-64 h-64 rounded-full opacity-10 animate-float"
          style={{ background: 'var(--color-accent)', filter: 'blur(60px)', bottom: '20%', right: '20%' }} />

        <div className="relative z-10 text-center px-12">
          <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 font-display font-black text-3xl text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              boxShadow: '0 8px 40px var(--glow-color)',
            }}>
            N
          </div>
          <h1 className="font-display font-black text-5xl mb-4 gradient-text">NendPlay</h1>
          <p className="text-lg leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
            Unlimited movies, music, podcasts,<br />live events and more
          </p>

          <div className="flex justify-center gap-8 mt-10">
            {['Movies', 'Music', 'Podcasts', 'Live Events'].map((item) => (
              <div key={item} className="text-center">
                <div className="w-2 h-2 rounded-full mx-auto mb-2"
                  style={{ background: 'var(--color-primary)' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--color-text-muted)' }}>{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 lg:max-w-md flex flex-col items-center justify-center px-8 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden mb-8 text-center">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-3 font-display font-black text-2xl text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            N
          </div>
          <h1 className="font-display font-black text-3xl gradient-text">NendPlay</h1>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="font-display font-bold text-3xl mb-2" style={{ color: 'var(--color-text)' }}>
            Welcome back
          </h2>
          <p className="text-sm mb-8" style={{ color: 'var(--color-text-muted)' }}>
            Sign in to continue watching
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Email Address or Username
              </label>
              <input
                type="text"
                autoCapitalize="none"
                placeholder="Enter email address or username"
                value={form.identifier}
                onChange={(e) => setForm({ ...form, identifier: e.target.value })}
                className="input-base"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-muted)' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="input-base pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                  style={{ color: 'var(--color-text-muted)' }}>
                  {showPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setResetMode(!resetMode)
                  setResetForm({ ...resetForm, identifier: resetForm.identifier || form.identifier })
                }}
                className="text-sm font-semibold"
                style={{ color: 'var(--color-primary)' }}>
                {resetMode ? 'Back to sign in' : 'Forgot password?'}
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 mt-6">
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  Sign In
                  <RiArrowRightLine />
                </>
              )}
            </button>
          </form>

          {resetMode && (
            <div className="mt-5 rounded-2xl p-4"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div className="flex items-center gap-2 mb-2">
                <RiKeyLine style={{ color: 'var(--color-primary)' }} />
                <h3 className="font-bold" style={{ color: 'var(--color-text)' }}>Recover password</h3>
              </div>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-muted)' }}>
                Enter your email address, request a reset token, then set a new password.
              </p>

              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Email address"
                  value={resetForm.identifier}
                  onChange={(e) => setResetForm({ ...resetForm, identifier: e.target.value })}
                  className="input-base"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleForgotPassword}
                  className="btn-primary w-full">
                  Get Reset Token
                </button>
                <input
                  type="text"
                  placeholder="Paste reset token"
                  value={resetForm.token}
                  onChange={(e) => setResetForm({ ...resetForm, token: e.target.value })}
                  className="input-base"
                />
                <div className="relative">
                  <input
                    type={showResetPassword ? 'text' : 'password'}
                    placeholder="New password"
                    value={resetForm.newPassword}
                    onChange={(e) => setResetForm({ ...resetForm, newPassword: e.target.value })}
                    className="input-base pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowResetPassword(!showResetPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
                    style={{ color: 'var(--color-text-muted)' }}>
                    {showResetPassword ? <RiEyeOffLine /> : <RiEyeLine />}
                  </button>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleResetPassword}
                  className="btn-primary w-full">
                  Reset Password
                </button>
              </div>
            </div>
          )}

          <p className="text-center text-sm mt-6" style={{ color: 'var(--color-text-muted)' }}>
            Don't have an account?{' '}
            <Link to="/register" className="font-semibold transition-colors"
              style={{ color: 'var(--color-primary)' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

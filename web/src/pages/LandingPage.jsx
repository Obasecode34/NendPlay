// src/pages/LandingPage.jsx
import React from 'react'
import { Link } from 'react-router-dom'
import { RiPlayFill, RiArrowRightLine, RiCheckLine } from 'react-icons/ri'
import useThemeStore from '../stores/themeStore'
import ThemePicker from '../components/common/ThemePicker'

export default function LandingPage() {
  const [showTheme, setShowTheme] = React.useState(false)

  const features = [
    { icon: '🎬', title: 'Movies & TV Shows', desc: 'Unlimited access to thousands of titles' },
    { icon: '🎵', title: 'Music & Podcasts', desc: 'Stream audio from all sources' },
    { icon: '🔴', title: 'Live Events', desc: 'Watch events as they happen' },
    { icon: '📚', title: 'NovelHub', desc: 'Read, upload and share documents' },
    { icon: '⚡', title: 'Shorts', desc: 'Quick videos under 3 minutes' },
    { icon: '📥', title: 'Offline Downloads', desc: 'Watch without internet' },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-display font-black text-lg text-white"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
            N
          </div>
          <span className="font-display font-black text-xl gradient-text">NendPlay</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowTheme(true)} className="btn-ghost py-2 px-4 text-sm">
            Theme
          </button>
          <Link to="/login" className="btn-ghost py-2 px-4 text-sm">Sign In</Link>
          <Link to="/register" className="btn-primary py-2 px-4 text-sm">Get Started</Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="relative text-center px-8 py-24 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute w-96 h-96 rounded-full opacity-15 animate-pulse-slow"
            style={{ background: 'var(--color-primary)', filter: 'blur(100px)', top: '0%', left: '20%' }} />
          <div className="absolute w-64 h-64 rounded-full opacity-10"
            style={{ background: 'var(--color-accent)', filter: 'blur(80px)', bottom: '10%', right: '20%' }} />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm mb-6"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', color: 'var(--color-primary)' }}>
            <RiPlayFill /> Now streaming worldwide
          </div>
          <h1 className="font-display font-black text-6xl mb-6 leading-tight">
            <span className="gradient-text">Unlimited</span>
            <br />
            <span style={{ color: 'var(--color-text)' }}>Entertainment</span>
          </h1>
          <p className="text-xl mb-8 max-w-xl mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Movies, music, podcasts, live events, shorts and more — all in one place.
          </p>
          <div className="flex items-center justify-center gap-4">
            <Link to="/home" className="btn-primary flex items-center gap-2 py-3 px-6 text-base">
              Continue as Guest <RiArrowRightLine />
            </Link>
            <Link to="/register" className="btn-ghost py-3 px-6 text-base">
              Create Account
            </Link>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="px-8 pb-24 max-w-5xl mx-auto">
        <h2 className="font-display font-bold text-3xl text-center mb-10"
          style={{ color: 'var(--color-text)' }}>
          Everything you need
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {features.map(({ icon, title, desc }) => (
            <div key={title} className="card p-5">
              <span className="text-3xl mb-3 block">{icon}</span>
              <h3 className="font-display font-bold text-base mb-1" style={{ color: 'var(--color-text)' }}>
                {title}
              </h3>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {showTheme && <ThemePicker onClose={() => setShowTheme(false)} />}
    </div>
  )
}

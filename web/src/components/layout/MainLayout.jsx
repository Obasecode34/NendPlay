import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  RiHomeFill, RiBookOpenFill, RiVideoFill, RiDownloadFill,
  RiUserFill, RiMenuFill, RiCloseFill, RiSearchLine,
  RiNotification3Line, RiBroadcastFill, RiSettings3Line,
  RiLogoutBoxRLine, RiMegaphoneFill, RiGiftFill, RiLoginBoxLine, RiUserAddLine,
  RiShieldUserFill
} from 'react-icons/ri'
import useAuthStore from '../../stores/authStore'
import useThemeStore from '../../stores/themeStore'
import ThemePicker from '../common/ThemePicker'
import MiniPlayer from '../media/MiniPlayer'

const navItems = [
  { to: '/home', icon: RiHomeFill, label: 'Home' },
  { to: '/novelhub', icon: RiBookOpenFill, label: 'NovelHub' },
  { to: '/shorts', icon: RiVideoFill, label: 'Shorts' },
  { to: '/downloads', icon: RiDownloadFill, label: 'Downloads' },
  { to: '/profile', icon: RiUserFill, label: 'Profile' },
]

const extraItems = [
  { to: '/subscribe', icon: RiBroadcastFill, label: 'Subscribe' },
  { to: '/advertise', icon: RiMegaphoneFill, label: 'Advertise' },
  { to: '/rewards', icon: RiGiftFill, label: 'Reward Coins' },
  { to: '/referrals', icon: RiGiftFill, label: 'Referrals' },
]

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { activeTheme } = useThemeStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  const handleLogout = async () => {
    await logout()
    navigate('/home')
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter' && searchQuery.trim()) {
      navigate(`/home?search=${encodeURIComponent(searchQuery.trim())}`)
      setSearchQuery('')
    }
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 flex flex-col transition-all duration-300
          ${sidebarOpen ? 'w-64' : 'w-20'}`}
        style={{
          background: 'var(--color-bg-deep)',
          borderRight: '1px solid var(--color-border)',
        }}>

        {/* Logo */}
        <div className="flex items-center gap-3 p-5 mb-2">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-display font-bold text-lg"
            style={{
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
              color: 'white',
              boxShadow: '0 4px 15px var(--glow-color)',
            }}>
            N
          </div>
          {sidebarOpen && (
            <span className="font-display font-bold text-xl gradient-text">
              NendPlay
            </span>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-7 w-6 h-6 rounded-full flex items-center justify-center"
          style={{
            background: 'var(--color-primary)',
            color: 'white',
            fontSize: '12px',
          }}>
          {sidebarOpen ? <RiCloseFill /> : <RiMenuFill />}
        </button>

        {/* Main nav */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200
                ${isActive
                  ? 'text-white'
                  : 'hover:text-white'
                }`
              }
              style={({ isActive }) => isActive ? {
                background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                boxShadow: '0 4px 15px var(--glow-color)',
                color: 'white',
              } : {
                color: 'var(--color-text-muted)',
              }}>
              <Icon className="text-xl flex-shrink-0" />
              {sidebarOpen && (
                <span className="font-body font-medium text-sm">{label}</span>
              )}
            </NavLink>
          ))}

          {/* Divider */}
          <div className="my-4" style={{ borderTop: '1px solid var(--color-border)' }} />

          {extraItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200`
              }
              style={({ isActive }) => isActive ? {
                background: 'var(--color-surface)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
              } : {
                color: 'var(--color-text-muted)',
              }}>
              <Icon className="text-xl flex-shrink-0" />
              {sidebarOpen && (
                <span className="font-body font-medium text-sm">{label}</span>
              )}
            </NavLink>
          ))}

          {['admin', 'super_admin'].includes(user?.role) && (
            <NavLink
              to="/admin"
              className="flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
              style={({ isActive }) => isActive ? {
                background: 'var(--color-surface)',
                color: 'var(--color-primary)',
                border: '1px solid var(--color-border)',
              } : {
                color: 'var(--color-text-muted)',
              }}>
              <RiShieldUserFill className="text-xl flex-shrink-0" />
              {sidebarOpen && (
                <span className="font-body font-medium text-sm">Admin</span>
              )}
            </NavLink>
          )}
        </nav>

        {/* Bottom: theme + logout */}
        <div className="p-3 space-y-1" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button
            onClick={() => setShowThemePicker(!showThemePicker)}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
            <RiSettings3Line className="text-xl flex-shrink-0" />
            {sidebarOpen && <span className="font-body text-sm font-medium">Theme</span>}
          </button>

          {isAuthenticated ? (
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
              style={{ color: 'var(--color-text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#EF4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
              <RiLogoutBoxRLine className="text-xl flex-shrink-0" />
              {sidebarOpen && <span className="font-body text-sm font-medium">Logout</span>}
            </button>
          ) : (
            <>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                <RiLoginBoxLine className="text-xl flex-shrink-0" />
                {sidebarOpen && <span className="font-body text-sm font-medium">Sign In</span>}
              </button>
              <button
                onClick={() => navigate('/register')}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all duration-200"
                style={{ color: 'var(--color-text-muted)' }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
                <RiUserAddLine className="text-xl flex-shrink-0" />
                {sidebarOpen && <span className="font-body text-sm font-medium">Create Account</span>}
              </button>
            </>
          )}
        </div>
      </aside>

      {/* ── Main content ──────────────────────────────────────────── */}
      <main
        className={`flex-1 flex flex-col transition-all duration-300 min-h-screen
          ${sidebarOpen ? 'ml-64' : 'ml-20'}`}>

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex items-center justify-between px-6 py-4"
          style={{
            background: 'rgba(var(--color-bg-deep), 0.8)',
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid var(--color-border)',
          }}>

          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <RiSearchLine
              className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
              style={{ color: 'var(--color-text-muted)' }} />
            <input
              type="text"
              placeholder="Search movies, music, shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearch}
              className="input-base pl-10 py-2.5"
              style={{ maxWidth: '400px' }}
            />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 ml-4">
            <button
              className="w-10 h-10 rounded-xl flex items-center justify-center transition-colors"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              <RiNotification3Line className="text-xl" />
            </button>

            {/* User avatar */}
            <NavLink to="/profile"
              className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
              style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center overflow-hidden text-xs font-bold text-white"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' }}>
                {user?.profilePic ? (
                  <img
                    src={user.profilePic}
                    alt=""
                    className="h-full w-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  user?.profileName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'G'
                )}
              </div>
              <span className="text-sm font-medium hidden md:block"
                style={{ color: 'var(--color-text)' }}>
                {user?.profileName || user?.username || 'Guest'}
              </span>
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>

      {/* ── Theme Picker Overlay ──────────────────────────────────── */}
      {showThemePicker && (
        <ThemePicker onClose={() => setShowThemePicker(false)} />
      )}

      {/* ── Mini Player (persistent bottom player) ────────────────── */}
      <MiniPlayer />
    </div>
  )
}

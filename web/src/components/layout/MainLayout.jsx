import React, { useEffect, useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import {
  RiHomeFill, RiBookOpenFill, RiVideoFill, RiDownloadFill,
  RiUserFill, RiMenuFill, RiCloseFill, RiSearchLine,
  RiNotification3Line, RiBroadcastFill, RiSettings3Line,
  RiLogoutBoxRLine, RiMegaphoneFill, RiGiftFill, RiLoginBoxLine, RiUserAddLine,
  RiShieldUserFill, RiNewspaperFill
} from 'react-icons/ri'
import useAuthStore from '../../stores/authStore'
import useThemeStore from '../../stores/themeStore'
import ThemePicker from '../common/ThemePicker'
import MiniPlayer from '../media/MiniPlayer'
import { notificationService } from '../../services'

const navItems = [
  { to: '/home', icon: RiHomeFill, label: 'Home' },
  { to: '/novelhub', icon: RiBookOpenFill, label: 'NovelHub' },
  { to: '/shorts', icon: RiVideoFill, label: 'Shorts' },
  { to: '/downloads', icon: RiDownloadFill, label: 'Downloads' },
  { to: '/news', icon: RiNewspaperFill, label: 'News' },
  { to: '/profile', icon: RiUserFill, label: 'Profile' },
]

const extraItems = [
  { to: '/subscribe', icon: RiBroadcastFill, label: 'Subscribe' },
  { to: '/advertise', icon: RiMegaphoneFill, label: 'Advertise' },
  { to: '/rewards', icon: RiGiftFill, label: 'Reward Coins' },
  { to: '/referrals', icon: RiGiftFill, label: 'Referrals' },
]

function NendPlayHeaderLogo() {
  return (
    <NavLink to="/home" className="flex items-center" aria-label="NendPlay Media home">
      <div className="leading-none">
        <div className="flex items-center">
          <span className="font-display text-[24px] font-black text-white sm:text-[28px]">NENDPL</span>
          <span className="relative mx-0.5 inline-flex h-7 w-6 items-center justify-center sm:h-8 sm:w-7">
            <span
              className="absolute h-0 w-0 rotate-[-10deg] border-y-[10px] border-l-[17px] border-y-transparent sm:border-y-[11px] sm:border-l-[19px]"
              style={{ borderLeftColor: '#8B5CF6' }}
            />
            <span className="absolute left-[7px] top-[9px] h-1.5 w-1.5 rounded-full bg-white sm:left-[8px] sm:top-[10px]" />
          </span>
          <span className="font-display text-[24px] font-black text-white sm:text-[28px]">Y</span>
        </div>
        <div className="ml-[29px] mt-0 flex gap-[9px] text-[10px] font-black text-[#B456FF] sm:ml-[34px] sm:gap-[11px] sm:text-[11px]">
          {'MEDIA'.split('').map((letter) => <span key={letter}>{letter}</span>)}
        </div>
      </div>
    </NavLink>
  )
}

export default function MainLayout() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const { activeTheme } = useThemeStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showThemePicker, setShowThemePicker] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [notificationsLoading, setNotificationsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [popupNotice, setPopupNotice] = useState(null)

  useEffect(() => {
    if (isAuthenticated) loadNotifications(false)
    else {
      setNotifications([])
      setUnreadCount(0)
    }
  }, [isAuthenticated])

  useEffect(() => {
    loadPublicPopups()
    const id = setInterval(loadPublicPopups, 60000)
    return () => clearInterval(id)
  }, [])

  const handleLogout = async () => {
    await logout()
    navigate('/home')
  }

  const submitSearch = () => {
    const query = searchQuery.trim()
    if (!query) {
      setSearchOpen((value) => !value)
      return
    }
    navigate(`/home?search=${encodeURIComponent(query)}`)
    setSearchQuery('')
    setSearchOpen(false)
  }

  const handleSearch = (e) => {
    if (e.key === 'Enter') submitSearch()
  }

  const loadNotifications = async (showLoader = true) => {
    if (!isAuthenticated) return
    if (showLoader) setNotificationsLoading(true)
    try {
      const res = await notificationService.getMine({ page: 1, limit: 20 })
      const data = res.data?.data || {}
      setNotifications(data.notifications || [])
      setUnreadCount(data.unread || 0)
    } catch {
      setNotifications([])
    } finally {
      setNotificationsLoading(false)
    }
  }

  const openNotifications = () => {
    setShowNotifications((value) => !value)
    loadNotifications(true)
  }

  const openNotification = async (item) => {
    try {
      if (!item.isRead) {
        await notificationService.markRead(item._id)
        setNotifications((current) => current.map((entry) => (
          entry._id === item._id ? { ...entry, isRead: true } : entry
        )))
        setUnreadCount((count) => Math.max(count - 1, 0))
      }
    } catch {}
    setShowNotifications(false)
    const routes = {
      Home: '/home',
      Shorts: '/shorts',
      NovelHub: '/novelhub',
      News: '/home',
      Rewards: '/rewards',
      Subscription: '/subscribe',
      Downloads: '/downloads',
      Profile: '/profile',
    }
    const linkedType = item.contentType || item.data?.contentType
    const linkedId = item.contentId || item.data?.contentId || item.data?.newsId || item.data?.mediaId
    if (linkedType === 'news' && linkedId) {
      navigate(`/news/${linkedId}`)
      return
    }
    if (linkedType === 'media' && linkedId) {
      navigate(`/watch/${linkedId}`)
      return
    }
    navigate(routes[item.screen] || '/home')
  }

  const getDismissedPopups = () => {
    try {
      return JSON.parse(localStorage.getItem('nendplay-dismissed-popups') || '[]')
    } catch {
      return []
    }
  }

  const dismissPopupNotice = () => {
    if (popupNotice?._id) {
      const dismissed = getDismissedPopups()
      const next = [...new Set([...dismissed, popupNotice._id])].slice(-100)
      localStorage.setItem('nendplay-dismissed-popups', JSON.stringify(next))
    }
    setPopupNotice(null)
  }

  const loadPublicPopups = async () => {
    try {
      const res = await notificationService.getPublicPopups({ limit: 5 })
      const notices = res.data?.data?.notifications || []
      const dismissed = getDismissedPopups()
      const nextNotice = notices.find((item) => !dismissed.includes(item._id))
      if (nextNotice) setPopupNotice((current) => current || nextNotice)
    } catch {}
  }

  const openPopupNotice = () => {
    if (!popupNotice) return
    const item = popupNotice
    dismissPopupNotice()
    const routes = {
      Home: '/home',
      Shorts: '/shorts',
      NovelHub: '/novelhub',
      News: '/news',
      Rewards: '/rewards',
      Subscription: '/subscribe',
      Downloads: '/downloads',
      Profile: '/profile',
    }
    const linkedType = item.contentType || item.data?.contentType
    const linkedId = item.contentId || item.data?.contentId || item.data?.newsId || item.data?.mediaId
    if (linkedType === 'news' && linkedId) {
      navigate(`/news/${linkedId}`)
      return
    }
    if (linkedType === 'media' && linkedId) {
      navigate(`/watch/${linkedId}`)
      return
    }
    navigate(routes[item.screen] || '/home')
  }

  const markAllNotificationsRead = async () => {
    try {
      await notificationService.markAllRead()
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })))
      setUnreadCount(0)
    } catch {}
  }

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--color-bg)' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        className={`fixed left-0 top-0 h-full z-40 hidden md:flex flex-col transition-all duration-300
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
        className={`w-full flex-1 flex flex-col transition-all duration-300 min-h-screen pb-20 md:pb-0
          ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'}`}>

        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 px-4 sm:h-[72px] sm:px-6 md:px-8"
          style={{
            background: 'linear-gradient(90deg, #030409 0%, #05050C 50%, #030308 100%)',
            borderBottom: '1px solid rgba(139, 92, 246, 0.18)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.28)',
          }}>

          <NendPlayHeaderLogo />

          {/* Right side */}
          <div className="ml-auto flex items-center gap-3 sm:gap-4">
            <div className="relative">
              <button
                type="button"
                onClick={submitSearch}
                className="flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 sm:h-12 sm:w-12"
                style={{ border: '1px solid rgba(255,255,255,0.28)', color: '#FFFFFF', background: 'rgba(255,255,255,0.02)' }}
                aria-label="Search">
                <RiSearchLine className="text-2xl" />
              </button>
              {searchOpen && (
                <div
                  className="absolute right-0 top-14 z-50 w-[min(84vw,360px)] rounded-2xl p-2"
                  style={{ background: 'rgba(5,5,15,0.98)', border: '1px solid rgba(139,92,246,0.35)', boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}>
                  <div className="relative">
                    <RiSearchLine
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-lg"
                      style={{ color: 'var(--color-text-muted)' }} />
                    <input
                      autoFocus
                      type="text"
                      placeholder="Search movies, music, shows..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={handleSearch}
                      className="input-base pl-10 py-3"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={openNotifications}
                className="relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:bg-white/10 sm:h-12 sm:w-12"
                style={{ border: '1px solid rgba(255,255,255,0.28)', color: '#FFFFFF', background: 'rgba(255,255,255,0.02)' }}
                aria-label="Notifications">
                <RiNotification3Line className="text-2xl" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[10px] font-black text-white"
                    style={{ background: '#8B5CF6' }}>
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="fixed left-3 right-3 top-16 max-h-96 overflow-hidden rounded-2xl z-50 md:absolute md:left-auto md:right-0 md:top-auto md:mt-3 md:w-80"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }}>
                  <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <div>
                      <p className="font-black" style={{ color: 'var(--color-text)' }}>Notifications</p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{unreadCount} unread</p>
                    </div>
                    <button className="btn-ghost px-3 py-1 text-xs" onClick={markAllNotificationsRead}>
                      Mark all
                    </button>
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {notificationsLoading ? (
                      <p className="p-4 text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
                    ) : notifications.length === 0 ? (
                      <p className="p-4 text-sm text-center" style={{ color: 'var(--color-text-muted)' }}>No notifications yet</p>
                    ) : notifications.map((item) => (
                      <button
                        key={item._id}
                        type="button"
                        onClick={() => openNotification(item)}
                        className="w-full text-left p-3 rounded-xl flex gap-3 transition-colors hover:bg-white/5">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt="" className="w-12 h-12 rounded-xl object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
                            <RiNotification3Line />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {!item.isRead && <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--color-primary)' }} />}
                            <p className="font-black text-sm truncate" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                          </div>
                          <p className="text-xs line-clamp-2 mt-1" style={{ color: 'var(--color-text-muted)' }}>{item.body}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* User avatar */}
            <NavLink to="/profile"
              className="flex h-11 w-11 items-center justify-center rounded-full transition-all sm:h-12 sm:w-12"
              style={{ border: '1px solid rgba(255,255,255,0.28)', background: 'rgba(255,255,255,0.02)' }}
              aria-label="Profile">
              <div
                className="h-9 w-9 overflow-hidden rounded-full flex items-center justify-center text-sm font-bold text-white sm:h-10 sm:w-10"
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
            </NavLink>
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 animate-fade-in">
          <Outlet />
        </div>
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex gap-1 overflow-x-auto px-2 py-2 md:hidden no-scrollbar"
        style={{
          background: 'rgba(4,4,15,0.94)',
          backdropFilter: 'blur(16px)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className="min-w-[68px] flex-1 rounded-2xl px-2 py-2 text-center transition-all"
            style={({ isActive }) => ({
              background: isActive ? 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))' : 'transparent',
              color: isActive ? '#fff' : 'var(--color-text-muted)',
            })}
          >
            <Icon className="mx-auto text-xl" />
            <span className="mt-1 block truncate text-[11px] font-bold">{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* ── Theme Picker Overlay ──────────────────────────────────── */}
      {showThemePicker && (
        <ThemePicker onClose={() => setShowThemePicker(false)} />
      )}

      {/* ── Mini Player (persistent bottom player) ────────────────── */}
      {popupNotice && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
          <div className="w-full max-w-md rounded-3xl overflow-hidden" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', boxShadow: '0 25px 80px rgba(0,0,0,0.45)' }}>
            {popupNotice.imageUrl && (
              <div className="aspect-video overflow-hidden" style={{ background: 'var(--color-surface-high)' }}>
                <img src={popupNotice.imageUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <div className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                    NendPlay Update
                  </p>
                  <h2 className="mt-2 font-display font-black text-2xl leading-tight" style={{ color: 'var(--color-text)' }}>
                    {popupNotice.title}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={dismissPopupNotice}
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}
                  aria-label="Close pop-up message"
                >
                  <RiCloseFill />
                </button>
              </div>
              <p className="mt-3 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {popupNotice.body}
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={dismissPopupNotice}>
                  Later
                </button>
                <button type="button" className="btn-primary px-4 py-2 text-sm" onClick={openPopupNotice}>
                  Open
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <MiniPlayer />
    </div>
  )
}

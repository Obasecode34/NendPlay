import React, { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './stores/authStore'
import useThemeStore from './stores/themeStore'
import { analyticsService } from './services'

// Layout
import MainLayout from './components/layout/MainLayout'

// Pages
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import HomePage from './pages/HomePage'
import NovelHubPage from './pages/NovelHubPage'
import ShortsPage from './pages/ShortsPage'
import DownloadsPage from './pages/DownloadsPage'
import ProfilePage from './pages/ProfilePage'
import MediaPlayerPage from './pages/MediaPlayerPage'
import SubscriptionPage from './pages/SubscriptionPage'
import AdvertisePage from './pages/AdvertisePage'
import ReferralPage from './pages/ReferralPage'
import RewardsPage from './pages/RewardsPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import NotFoundPage from './pages/NotFoundPage'
import DailyNewsPage from './pages/DailyNewsPage'
import NewsArticlePage from './pages/NewsArticlePage'

// Public route (redirect to home if already logged in)
const PublicRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuthStore()
  if (isLoading) return null
  return isAuthenticated ? <Navigate to="/home" replace /> : children
}

export default function App() {
  const { initAuth } = useAuthStore()
  const { activeTheme } = useThemeStore()

  // Check auth on app load
  useEffect(() => {
    initAuth()
    const key = 'nendplay-analytics-guest-id'
    const existing = localStorage.getItem(key)
    const guestId = existing || `web-${Date.now()}-${Math.random().toString(36).slice(2)}`
    if (!existing) localStorage.setItem(key, guestId)
    analyticsService.track({
      eventType: 'app_open',
      platform: 'web',
      screen: 'app',
      guestId,
    }).catch(() => {})
  }, [])

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme)
  }, [activeTheme])

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<Navigate to="/home" replace />} />
      <Route path="/welcome" element={<PublicRoute><LandingPage /></PublicRoute>} />
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      {/* App routes inside MainLayout. Guests can browse the app. */}
      <Route path="/" element={<MainLayout />}>
        <Route path="home" element={<HomePage />} />
        <Route path="novelhub" element={<NovelHubPage />} />
        <Route path="shorts" element={<ShortsPage />} />
        <Route path="downloads" element={<DownloadsPage />} />
        <Route path="news" element={<DailyNewsPage />} />
        <Route path="news/:id" element={<NewsArticlePage />} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="watch/:id" element={<MediaPlayerPage />} />
        <Route path="subscribe" element={<SubscriptionPage />} />
        <Route path="advertise" element={<AdvertisePage />} />
        <Route path="referrals" element={<ReferralPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="admin" element={<AdminDashboardPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

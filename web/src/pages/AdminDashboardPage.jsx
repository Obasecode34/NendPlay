import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactPlayer from 'react-player/lazy'
import toast from 'react-hot-toast'
import {
  RiAdvertisementLine,
  RiBookOpenLine,
  RiDashboardLine,
  RiDownloadLine,
  RiDeleteBinLine,
  RiEyeLine,
  RiFilmLine,
  RiGiftLine,
  RiMailLine,
  RiNewspaperLine,
  RiNotification3Line,
  RiShieldUserLine,
  RiUserLine,
  RiVipCrownLine,
} from 'react-icons/ri'
import useAuthStore from '../stores/authStore'
import { adminService } from '../services/index'

const tabs = [
  { id: 'overview', label: 'Overview', icon: RiDashboardLine },
  { id: 'statistics', label: 'Statistics', icon: RiDashboardLine },
  { id: 'users', label: 'Users', icon: RiUserLine },
  { id: 'media', label: 'Media', icon: RiFilmLine },
  { id: 'documents', label: 'NovelHub', icon: RiBookOpenLine },
  { id: 'ads', label: 'Ads', icon: RiAdvertisementLine },
  { id: 'subscriptions', label: 'Subscriptions', icon: RiVipCrownLine },
  { id: 'downloads', label: 'Downloads', icon: RiDownloadLine },
  { id: 'rewards', label: 'Rewards', icon: RiGiftLine },
  { id: 'news', label: 'News', icon: RiNewspaperLine },
  { id: 'notifications', label: 'Notifications', icon: RiNotification3Line },
]

const badgeColors = {
  active: '#34D399',
  published: '#34D399',
  pending_review: '#FBBF24',
  pending_payment: '#FBBF24',
  draft: '#A78BFA',
  paused: '#60A5FA',
  archived: '#9CA3AF',
  inactive: '#EF4444',
  rejected: '#EF4444',
  failed: '#EF4444',
}

const MEDIA_CATEGORY_OPTIONS = [
  'All', 'Hollywood', 'Nollywood', 'Bollywood', 'Western', 'K-Drama',
  'Chinese Cinema', 'Hong Kong Cinema', 'Japanese Cinema', 'Australian Cinema', 'Philippine Cinema', 'European Cinema',
]
const MEDIA_NAVIGATION_OPTIONS = ['Shorts', 'Trending', 'Movie', 'Anime', 'Cartoon', 'Sports', 'WWE']
const MOVIE_GENRE_OPTIONS = [
  'Action', 'Adventure', 'Sports', 'Martial Arts', 'Comedy', 'Drama', 'Romance',
  'Horror', 'Mystery', 'Crime', 'Fantasy', 'Science Fiction', 'Animation',
  'Family', 'Musical', 'Documentary', 'War', 'Western', 'Biography', 'WWE',
]
const MEDIA_TYPE_OPTIONS = ['movie', 'video', 'music', 'tv_show', 'comedy', 'talk_show', 'podcast', 'short', 'live_event']
const PUBLISH_STATUS_OPTIONS = ['draft', 'processing', 'pending_review', 'published', 'rejected', 'failed', 'archived']
const COLLECTION_TYPE_OPTIONS = [
  { value: 'single', label: 'Single title' },
  { value: 'movie_part', label: 'Movie with parts' },
  { value: 'series_episode', label: 'Series/episode' },
]

const NOVEL_GENRE_OPTIONS = [
  'business', 'love', 'finance', 'drama', 'fiction', 'non-fiction', 'mystery',
  'horror', 'fan-fiction', 'sci-fi', 'urban', 'teen', 'military-history',
  'games-sport', 'literature', 'eastern-fantasy', 'western-fantasy',
]

const DOCUMENT_LICENSE_OPTIONS = [
  'public_domain', 'cc0', 'cc_by', 'cc_by_sa', 'cc_by_nc', 'cc_by_nc_sa',
  'cc_by_nd', 'cc_by_nc_nd',
]

const TRUSTED_DOCUMENT_SOURCE_OPTIONS = [
  'Project Gutenberg',
  'Standard Ebooks',
  'Internet Archive',
  'Open Library',
  'Government Library',
  'Educational Library',
]

const NEWS_TAB_OPTIONS = [
  { value: 'for-you', label: 'For You' },
  { value: 'headlines', label: 'Headlines' },
  { value: 'local', label: 'Local' },
  { value: 'nigeria', label: 'Nigeria' },
  { value: 'world', label: 'World' },
  { value: 'business', label: 'Business' },
  { value: 'technology', label: 'Technology' },
  { value: 'entertainment', label: 'Entertainment' },
  { value: 'sports', label: 'Sports' },
  { value: 'science', label: 'Science' },
  { value: 'health', label: 'Health' },
]

const NEWS_SECTION_OPTIONS = [
  { value: 'news', label: 'News' },
  { value: 'career', label: 'Career' },
  { value: 'unspoken', label: 'Unspoken' },
]

const CAREER_JOB_MODE_OPTIONS = [
  { value: 'on-site', label: 'On-Site Jobs' },
  { value: 'remote', label: 'Remote Jobs' },
  { value: 'hybrid', label: 'Hybrid Jobs' },
]

const CAREER_CATEGORY_OPTIONS = [
  'Agriculture', 'Arts & Entertainment', 'Business', 'Construction', 'Education',
  'Engineering', 'Finance', 'Government', 'Healthcare', 'Information Technology',
  'Law', 'Manufacturing', 'Media & Communications', 'Military', 'Science',
  'Social Services', 'Sports', 'Transportation', 'Hospitality & Tourism',
  'Skilled Trades', 'Environmental Services', 'Virtual Assistance',
].map((label) => ({ value: label.toLowerCase(), label }))

function listToInput(value) {
  return Array.isArray(value) ? value.join(', ') : value || ''
}

function normalizeInputList(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5)
}

function normalizeGenrePinKey(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function normalizeGenrePins(value) {
  if (!value) return {}
  const entries = value instanceof Map ? Array.from(value.entries()) : Object.entries(value)
  return entries.reduce((next, [genre, position]) => {
    const key = normalizeGenrePinKey(genre)
    const numericPosition = Number(position)
    if (key && Number.isInteger(numericPosition) && numericPosition >= 1 && numericPosition <= 4) {
      next[key] = numericPosition
    }
    return next
  }, {})
}

function Badge({ children }) {
  const key = String(children || '').toLowerCase()
  return (
    <span className="px-2 py-1 rounded-lg text-xs font-black"
      style={{ background: `${badgeColors[key] || 'var(--color-primary)'}22`, color: badgeColors[key] || 'var(--color-primary)' }}>
      {children}
    </span>
  )
}

function StatCard({ label, value, icon: Icon }) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
          <p className="text-3xl font-black mt-2" style={{ color: 'var(--color-text)' }}>{value}</p>
        </div>
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
          <Icon className="text-2xl" />
        </div>
      </div>
    </div>
  )
}

function compactNumber(value) {
  const number = Number(value || 0)
  if (number >= 1000000) return `${(number / 1000000).toFixed(1)}M`
  if (number >= 1000) return `${(number / 1000).toFixed(1)}K`
  return number.toLocaleString()
}

function eventValue(period, key) {
  return period?.[key]?.total || 0
}

function BarChart({ title, items }) {
  const max = Math.max(...items.map((item) => Number(item.value || 0)), 1)
  return (
    <div className="card p-5">
      <h3 className="font-black mb-4" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold" style={{ color: 'var(--color-text-muted)' }}>{item.label}</span>
              <span className="font-black" style={{ color: 'var(--color-text)' }}>{compactNumber(item.value)}</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full" style={{ background: 'var(--color-surface-high)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.max(4, (Number(item.value || 0) / max) * 100)}%`,
                  background: item.color || 'var(--color-primary)',
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function DonutChart({ title, items }) {
  const total = items.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1
  let cursor = 0
  const stops = items.map((item) => {
    const start = cursor
    const end = cursor + (Number(item.value || 0) / total) * 100
    cursor = end
    return `${item.color} ${start}% ${end}%`
  }).join(', ')

  return (
    <div className="card p-5">
      <h3 className="font-black mb-4" style={{ color: 'var(--color-text)' }}>{title}</h3>
      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div
          className="h-36 w-36 rounded-full"
          style={{ background: `conic-gradient(${stops || '#2A2350 0% 100%'})` }}
        >
          <div className="m-8 h-20 w-20 rounded-full" style={{ background: 'var(--color-surface)' }} />
        </div>
        <div className="flex-1 space-y-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex items-center gap-2 font-bold" style={{ color: 'var(--color-text-muted)' }}>
                <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                {item.label}
              </span>
              <span className="font-black" style={{ color: 'var(--color-text)' }}>{compactNumber(item.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatisticsPanel({ analytics }) {
  const daily = analytics?.periods?.daily || {}
  const weekly = analytics?.periods?.weekly || {}
  const yearly = analytics?.periods?.yearly || {}
  const totals = analytics?.totals || {}

  const engagementItems = [
    { label: 'Movies watched', value: eventValue(weekly, 'media_watch') || totals.media?.views || 0, color: '#7C3AED' },
    { label: 'Novels read', value: eventValue(weekly, 'novel_read') || totals.novels?.views || 0, color: '#22C55E' },
    { label: 'News read', value: eventValue(weekly, 'news_read') || totals.newsBySection?.news?.views || totals.news?.views || 0, color: '#38BDF8' },
    { label: 'Jobs clicked', value: eventValue(weekly, 'career_click') || totals.newsBySection?.career?.views || 0, color: '#F59E0B' },
    { label: 'Unspoken opened', value: eventValue(weekly, 'unspoken_open') || totals.newsBySection?.unspoken?.views || 0, color: '#EC4899' },
  ]

  const socialItems = [
    { label: 'Comments', value: eventValue(weekly, 'comment') || (totals.media?.comments || 0) + (totals.news?.comments || 0), color: '#A78BFA' },
    { label: 'Shares', value: eventValue(weekly, 'share') || totals.news?.shares || 0, color: '#60A5FA' },
    { label: 'Likes', value: eventValue(weekly, 'like') || (totals.media?.likes || 0) + (totals.novels?.likes || 0) + (totals.news?.likes || 0), color: '#F472B6' },
    { label: 'Ad impressions', value: eventValue(weekly, 'ad_impression') || totals.ads?.impressions || 0, color: '#FBBF24' },
    { label: 'Ad clicks', value: eventValue(weekly, 'ad_click') || totals.ads?.clicks || 0, color: '#34D399' },
  ]

  const userMixItems = [
    { label: 'Guests today', value: totals.users?.guestsToday || 0, color: '#38BDF8' },
    { label: 'Registered', value: totals.users?.registered || 0, color: '#7C3AED' },
    { label: 'Admins', value: totals.users?.admins || 0, color: '#F59E0B' },
  ]

  const newsSectionItems = [
    { label: 'News', value: totals.newsBySection?.news?.views || 0, color: '#22C55E' },
    { label: 'Career', value: totals.newsBySection?.career?.views || 0, color: '#F97316' },
    { label: 'Unspoken', value: totals.newsBySection?.unspoken?.views || 0, color: '#EC4899' },
  ]

  const periodRows = [
    ['Today', daily],
    ['This week', weekly],
    ['This year', yearly],
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total Users" value={compactNumber(totals.users?.total)} icon={RiUserLine} />
        <StatCard label="Guests Today" value={compactNumber(totals.users?.guestsToday)} icon={RiUserLine} />
        <StatCard label="Registered Users" value={compactNumber(totals.users?.registered)} icon={RiUserLine} />
        <StatCard label="Admins" value={compactNumber(totals.users?.admins)} icon={RiShieldUserLine} />
        <StatCard label="Movies Watched" value={compactNumber(totals.media?.views)} icon={RiFilmLine} />
        <StatCard label="Novels Read" value={compactNumber(totals.novels?.views)} icon={RiBookOpenLine} />
        <StatCard label="News Engagement" value={compactNumber((totals.news?.views || 0) + (totals.news?.likes || 0) + (totals.news?.comments || 0) + (totals.news?.shares || 0))} icon={RiNewspaperLine} />
        <StatCard label="Ad Activity" value={compactNumber((totals.ads?.impressions || 0) + (totals.ads?.clicks || 0))} icon={RiAdvertisementLine} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <BarChart title="Weekly Content Activity" items={engagementItems} />
        <BarChart title="Weekly Engagement & Ads" items={socialItems} />
        <DonutChart title="User Mix" items={userMixItems} />
        <DonutChart title="News, Career & Unspoken Reads" items={newsSectionItems} />
      </div>

      <div className="card overflow-hidden">
        <div className="p-5" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <h3 className="font-black" style={{ color: 'var(--color-text)' }}>Daily, Weekly, Yearly Summary</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-[820px] w-full text-left text-sm">
            <thead>
              <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
                {['Period', 'App Opens', 'Screen Views', 'Media', 'Novels', 'News', 'Jobs', 'Unspoken', 'Comments', 'Shares', 'Likes'].map((item) => (
                  <th key={item} className="px-4 py-3 font-black">{item}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {periodRows.map(([label, period]) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td className="px-4 py-3 font-black" style={{ color: 'var(--color-text)' }}>{label}</td>
                  {['app_open', 'screen_view', 'media_watch', 'novel_read', 'news_read', 'career_click', 'unspoken_open', 'comment', 'share', 'like'].map((key) => (
                    <td key={key} className="px-4 py-3" style={{ color: 'var(--color-text-muted)' }}>{compactNumber(eventValue(period, key))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function TableShell({ title, children, search, setSearch, filters }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap">
          <input
            className="input-base py-2 sm:min-w-64"
            placeholder="Search..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {filters}
        </div>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function DataTable({ columns, rows, renderActions }) {
  return (
    <table className="min-w-[760px] w-full text-left text-sm">
      <thead>
        <tr style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>
          {columns.map((column) => <th key={column.key} className="px-4 py-3 font-black">{column.label}</th>)}
          {renderActions && <th className="px-4 py-3 font-black">Actions</th>}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row._id || row.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
            {columns.map((column) => (
              <td key={column.key} className="px-4 py-3 align-top" style={{ color: 'var(--color-text)' }}>
                {column.render ? column.render(row) : row[column.key]}
              </td>
            ))}
            {renderActions && <td className="px-4 py-3 align-top">{renderActions(row)}</td>}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default function AdminDashboardPage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, updateUser } = useAuthStore()
  const [activeTab, setActiveTab] = useState('overview')
  const [dashboard, setDashboard] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pagination, setPagination] = useState(null)
  const [selectedUserDetails, setSelectedUserDetails] = useState(null)
  const [messageTarget, setMessageTarget] = useState(null)
  const [messageForm, setMessageForm] = useState({ subject: '', message: '' })
  const [mediaEditTarget, setMediaEditTarget] = useState(null)
  const [mediaEditForm, setMediaEditForm] = useState(null)
  const [mediaThumbnailFile, setMediaThumbnailFile] = useState(null)
  const [previewMedia, setPreviewMedia] = useState(null)
  const [previewAd, setPreviewAd] = useState(null)
  const [adminAdFormOpen, setAdminAdFormOpen] = useState(false)
  const [documentImportOpen, setDocumentImportOpen] = useState(false)
  const [adminAdFile, setAdminAdFile] = useState(null)
  const [adminAdForm, setAdminAdForm] = useState({
    advertiserName: 'NendPlay Media',
    title: '',
    description: '',
    mediaUrl: '',
    targetUrl: '',
    adType: 'banner',
    placement: 'home',
    targetAudience: 'unsubscribed',
    durationDays: 7,
    status: 'active',
  })
  const [documentImportForm, setDocumentImportForm] = useState({
    title: '',
    author: '',
    description: '',
    category: 'fiction',
    fileUrl: '',
    coverImage: '',
    sourceName: 'Project Gutenberg',
    sourceUrl: '',
    licenseType: 'public_domain',
    licenseUrl: '',
    attributionText: '',
    rightsSummary: '',
    tags: '',
  })
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [pushStats, setPushStats] = useState(null)
  const [pushForm, setPushForm] = useState({
    audience: 'all',
    userId: '',
    title: '',
    body: '',
    screen: 'Home',
    contentType: '',
    contentId: '',
  })
  const [notificationMode, setNotificationMode] = useState('push')
  const [inAppForm, setInAppForm] = useState({
    audience: 'all',
    userId: '',
    title: '',
    body: '',
    screen: 'Home',
    contentType: '',
    contentId: '',
  })
  const [pushImageFile, setPushImageFile] = useState(null)
  const [inAppImageFile, setInAppImageFile] = useState(null)
  const [pushSending, setPushSending] = useState(false)
  const [inAppSending, setInAppSending] = useState(false)
  const [notificationRows, setNotificationRows] = useState([])
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [bunnySyncing, setBunnySyncing] = useState(false)
  const [newsRows, setNewsRows] = useState([])
  const [newsMeta, setNewsMeta] = useState(null)
  const [newsFilters, setNewsFilters] = useState({
    section: 'news',
    tab: 'for-you',
    jobMode: '',
    country: 'Nigeria',
    city: '',
    region: '',
  })

  const isAdmin = ['admin', 'super_admin'].includes(user?.role)
  const isSuperAdmin = user?.role === 'super_admin'
  const debouncedSearch = useDebouncedValue(search, 350)

  useEffect(() => {
    if (!isAuthenticated) navigate('/login')
    else if (!isAdmin) navigate('/home')
  }, [isAuthenticated, isAdmin, navigate])

  useEffect(() => {
    if (!isAdmin) return
    if (activeTab === 'overview') loadDashboard()
    else if (activeTab === 'statistics') loadAnalyticsSummary()
    else if (activeTab === 'notifications') loadPushStats()
    else if (activeTab === 'news') loadNews(1)
    else loadTable(1)
  }, [activeTab, isAdmin, status, debouncedSearch, newsFilters.tab, newsFilters.section, newsFilters.jobMode])

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const res = await adminService.getDashboard()
      setDashboard(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admin dashboard failed to load')
    } finally {
      setLoading(false)
    }
  }

  const loadAnalyticsSummary = async () => {
    setLoading(true)
    try {
      const res = await adminService.getAnalyticsSummary()
      setAnalytics(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load statistics')
    } finally {
      setLoading(false)
    }
  }

  const endpointForTab = {
    users: adminService.getUsers,
    media: adminService.getMedia,
    documents: adminService.getDocuments,
    ads: adminService.getAds,
    subscriptions: adminService.getSubscriptions,
    downloads: adminService.getDownloads,
    rewards: adminService.getRewards,
  }

  const dataKeyForTab = {
    users: 'users',
    media: 'media',
    documents: 'documents',
    ads: 'ads',
    subscriptions: 'subscriptions',
    downloads: 'downloads',
    rewards: 'rewards',
  }

  const loadPushStats = async () => {
    setLoading(true)
    try {
      const [res] = await Promise.all([
        adminService.getPushStats(),
        loadAdminNotifications(false),
      ])
      setPushStats(res.data.data.stats)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load notification stats')
    } finally {
      setLoading(false)
    }
  }

  const loadAdminNotifications = async (showLoader = true) => {
    if (showLoader) setNotificationLoading(true)
    try {
      const res = await adminService.getInAppNotifications({ page: 1, limit: 25 })
      setNotificationRows(res.data?.data?.notifications || [])
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load sent notifications')
    } finally {
      setNotificationLoading(false)
    }
  }

  const deleteAdminNotification = async (id) => {
    if (!window.confirm('Delete this notification from users? This cannot be undone.')) return
    try {
      await adminService.deleteInAppNotification(id)
      toast.success('Notification deleted')
      loadPushStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete notification')
    }
  }

  const loadNews = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await adminService.getNewsPosts({
        page: nextPage,
        limit: 12,
        search: debouncedSearch || undefined,
        tab: newsFilters.tab,
        section: newsFilters.section,
        jobMode: newsFilters.jobMode || undefined,
      })
      const payload = res.data?.data?.data || res.data?.data || {}
      setNewsRows(payload.articles || [])
      setNewsMeta(payload)
      setPagination(payload.pagination || {
        page: payload.page || nextPage,
        limit: payload.limit || 12,
        total: payload.total || (payload.articles || []).length,
        pages: payload.pages || 1,
      })
      setPage(nextPage)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load news')
    } finally {
      setLoading(false)
    }
  }

  const sendPushNotification = async () => {
    if (!pushForm.title.trim() || !pushForm.body.trim()) {
      toast.error('Enter a title and message')
      return
    }
    if (pushForm.audience === 'user' && !pushForm.userId.trim()) {
      toast.error('Enter a user ID for a single-user notification')
      return
    }

    setPushSending(true)
    try {
      const payload = {
        audience: pushForm.audience === 'user' ? undefined : pushForm.audience,
        userId: pushForm.audience === 'user' ? pushForm.userId.trim() : undefined,
        title: pushForm.title.trim(),
        body: pushForm.body.trim(),
        data: {
          screen: pushForm.screen,
          source: 'admin',
          contentType: pushForm.contentType || undefined,
          contentId: pushForm.contentId.trim() || undefined,
          newsId: pushForm.contentType === 'news' ? pushForm.contentId.trim() : undefined,
          mediaId: pushForm.contentType === 'media' ? pushForm.contentId.trim() : undefined,
        },
      }
      let requestBody = payload
      if (pushImageFile) {
        requestBody = new FormData()
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          requestBody.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
        })
        requestBody.append('image', pushImageFile)
      }
      const res = await adminService.sendPushNotification(requestBody)
      const data = res.data?.data
      const adminTokens = data?.recipientStats?.adminTokens || 0
      const guestTokens = data?.recipientStats?.guestTokens || 0
      const parts = []
      if (adminTokens) parts.push(`${adminTokens} admin device${adminTokens === 1 ? '' : 's'}`)
      if (guestTokens) parts.push(`${guestTokens} guest device${guestTokens === 1 ? '' : 's'}`)
      const audienceNote = parts.length ? `, including ${parts.join(' and ')}` : ''
      if (!data?.sent) {
        const reason = !data?.requestedTokens
          ? 'No active devices have registered for push notifications yet. Open the mobile app and allow notifications, then try again.'
          : 'Registered devices were found, but no valid Expo push tokens were available.'
        toast.error(reason)
      } else {
        toast.success(`Sent ${data.sent} notification${data.sent === 1 ? '' : 's'}${audienceNote}`)
      }
      setPushForm({ audience: 'all', userId: '', title: '', body: '', screen: 'Home', contentType: '', contentId: '' })
      setPushImageFile(null)
      loadPushStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send push notification')
    } finally {
      setPushSending(false)
    }
  }

  const sendInAppNotification = async () => {
    if (!inAppForm.title.trim() || !inAppForm.body.trim()) {
      toast.error('Enter a title and message')
      return
    }
    if (notificationMode !== 'popup' && inAppForm.audience === 'user' && !inAppForm.userId.trim()) {
      toast.error('Enter a user ID for a single-user notification')
      return
    }

    setInAppSending(true)
    try {
      const payload = {
        audience: notificationMode === 'popup' ? 'all' : (inAppForm.audience === 'user' ? undefined : inAppForm.audience),
        userId: notificationMode === 'popup' ? undefined : (inAppForm.audience === 'user' ? inAppForm.userId.trim() : undefined),
        title: inAppForm.title.trim(),
        body: inAppForm.body.trim(),
        screen: inAppForm.screen,
        contentType: inAppForm.contentType || undefined,
        contentId: inAppForm.contentId.trim() || undefined,
        deliveryMode: notificationMode === 'popup' ? 'popup' : 'bell',
        data: {
          screen: inAppForm.screen,
          source: 'admin',
          deliveryMode: notificationMode === 'popup' ? 'popup' : 'bell',
          contentType: inAppForm.contentType || undefined,
          contentId: inAppForm.contentId.trim() || undefined,
          newsId: inAppForm.contentType === 'news' ? inAppForm.contentId.trim() : undefined,
          mediaId: inAppForm.contentType === 'media' ? inAppForm.contentId.trim() : undefined,
        },
      }
      let requestBody = payload
      if (inAppImageFile) {
        requestBody = new FormData()
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          requestBody.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value))
        })
        requestBody.append('image', inAppImageFile)
      }
      await adminService.sendInAppNotification(requestBody)
      toast.success(notificationMode === 'popup' ? 'Pop-up message sent' : 'Notification added to users bell inbox')
      setInAppForm({ audience: 'all', userId: '', title: '', body: '', screen: 'Home', contentType: '', contentId: '' })
      setInAppImageFile(null)
      loadPushStats()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send notification')
    } finally {
      setInAppSending(false)
    }
  }

  const syncBunnyLibrary = async () => {
    setBunnySyncing(true)
    try {
      const res = await adminService.syncBunnyMedia({
        limit: 100,
        maxPages: 10,
        autoApprove: false,
      })
      const data = res.data?.data || {}
      toast.success(`Bunny synced: ${data.imported || 0} imported, ${data.updated || 0} updated`)
      if (activeTab === 'media') loadTable(1)
      else loadDashboard()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not sync Bunny library')
    } finally {
      setBunnySyncing(false)
    }
  }

  const loadTable = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await endpointForTab[activeTab]({
        page: nextPage,
        limit: 25,
        search: debouncedSearch || undefined,
        status: status || undefined,
      })
      setRows(res.data.data[dataKeyForTab[activeTab]] || [])
      setPagination(res.data.data.pagination)
      setPage(nextPage)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load admin table')
    } finally {
      setLoading(false)
    }
  }

  const patchAndReload = async (label, action) => {
    try {
      const res = await action()
      if (res?.data?.data?.user?.id === user?.id) updateUser(res.data.data.user)
      toast.success(label)
      if (activeTab === 'overview') loadDashboard()
      else loadTable()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admin action failed')
    }
  }

  const viewUserDetails = async (row) => {
    if (!isSuperAdmin) return
    setDetailsLoading(true)
    try {
      const res = await adminService.getUserDetails(row._id)
      setSelectedUserDetails(res.data.data)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load user details')
    } finally {
      setDetailsLoading(false)
    }
  }

  const confirmDelete = (message, action) => {
    if (!window.confirm(message)) return
    patchAndReload('Deleted successfully', action)
  }

  const openMessageModal = (row) => {
    setMessageTarget(row)
    setMessageForm({ subject: '', message: '' })
  }

  const sendUserMessage = async () => {
    if (!messageTarget) return
    if (!messageForm.subject.trim() || !messageForm.message.trim()) {
      toast.error('Enter a subject and message')
      return
    }

    try {
      const res = await adminService.sendUserEmail(messageTarget._id, {
        subject: messageForm.subject.trim(),
        message: messageForm.message.trim(),
      })
      const sent = res.data?.data?.sent
      toast.success(sent ? 'Email sent' : 'Message logged in development mode')
      setMessageTarget(null)
      setMessageForm({ subject: '', message: '' })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not send message')
    }
  }

  const openMediaEditModal = (row) => {
    setMediaEditTarget(row)
    setMediaThumbnailFile(null)
    setMediaEditForm({
      title: row.title || '',
      description: row.description || '',
      type: row.type || 'video',
      categories: listToInput(row.categories?.length ? row.categories : [row.category].filter(Boolean)),
      navigationLabels: listToInput(row.navigationLabels?.length ? row.navigationLabels : row.homeSections || []),
      genres: listToInput(row.genres?.length ? row.genres : [row.genre].filter(Boolean)),
      genre: row.genre || '',
      language: row.language || '',
      country: row.country || '',
      publishStatus: row.publishStatus || 'pending_review',
      reviewStatus: row.reviewStatus || 'pending',
      reviewNote: row.reviewNote || '',
      isLocked: Boolean(row.isLocked),
      isActive: row.isActive !== false,
      isFeatured: Boolean(row.isFeatured),
      featuredRank: row.featuredRank || 0,
      genrePins: normalizeGenrePins(row.genrePins),
      thumbnailUrl: row.thumbnailUrl || '',
      collectionType: row.collectionType || 'single',
      parentTitle: row.parentTitle || '',
      seasonNumber: row.seasonNumber ?? '',
      episodeNumber: row.episodeNumber ?? '',
      partNumber: row.partNumber ?? '',
      episodeTitle: row.episodeTitle || '',
    })
  }

  const saveMediaEdit = async () => {
    if (!mediaEditTarget || !mediaEditForm) return
    const categories = normalizeInputList(mediaEditForm.categories)
    const navigationLabels = normalizeInputList(mediaEditForm.navigationLabels)
    const genres = normalizeInputList(mediaEditForm.genres || mediaEditForm.genre)
    if (!mediaEditForm.title.trim()) {
      toast.error('Media title is required')
      return
    }
    if (categories.length > 5 || navigationLabels.length > 5 || genres.length > 5) {
      toast.error('Use up to 5 categories, 5 navigation labels, and 5 genres')
      return
    }
    if (mediaEditForm.collectionType !== 'single' && !mediaEditForm.parentTitle.trim()) {
      toast.error('Enter the series/movie title for grouped media')
      return
    }

    const payload = {
      ...mediaEditForm,
      title: mediaEditForm.title.trim(),
      categories,
      navigationLabels,
      genres,
      genre: genres[0] || '',
      category: categories[0] || mediaEditForm.category || 'general',
      homeSections: navigationLabels,
      featuredRank: Number(mediaEditForm.featuredRank) || 0,
      genrePins: normalizeGenrePins(mediaEditForm.genrePins),
      collectionType: mediaEditForm.collectionType || 'single',
      parentTitle: mediaEditForm.collectionType === 'single' ? '' : mediaEditForm.parentTitle.trim(),
      seasonNumber: mediaEditForm.collectionType === 'series_episode' ? mediaEditForm.seasonNumber : '',
      episodeNumber: mediaEditForm.collectionType === 'series_episode' ? mediaEditForm.episodeNumber : '',
      partNumber: mediaEditForm.collectionType === 'movie_part' ? mediaEditForm.partNumber : '',
      episodeTitle: mediaEditForm.collectionType === 'series_episode' ? mediaEditForm.episodeTitle.trim() : '',
    }

    try {
      let requestBody = payload
      if (mediaThumbnailFile) {
        requestBody = new FormData()
        Object.entries(payload).forEach(([key, value]) => {
          if (Array.isArray(value)) requestBody.append(key, JSON.stringify(value))
          else if (value && typeof value === 'object') requestBody.append(key, JSON.stringify(value))
          else requestBody.append(key, value === undefined || value === null ? '' : String(value))
        })
        requestBody.append('thumbnail', mediaThumbnailFile)
      }
      await adminService.updateMedia(mediaEditTarget._id, requestBody)
      toast.success('Media updated')
      setMediaEditTarget(null)
      setMediaEditForm(null)
      setMediaThumbnailFile(null)
      loadTable()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not update media')
    }
  }

  const createAdminAd = async () => {
    if (!adminAdForm.title.trim() || !adminAdForm.advertiserName.trim()) {
      toast.error('Enter advertiser name and ad title')
      return
    }
    try {
      let requestBody = adminAdForm
      if (adminAdFile) {
        requestBody = new FormData()
        Object.entries(adminAdForm).forEach(([key, value]) => requestBody.append(key, String(value ?? '')))
        requestBody.append('creative', adminAdFile)
      }
      await adminService.createAd(requestBody)
      toast.success('Admin ad created')
      setAdminAdFormOpen(false)
      setAdminAdFile(null)
      setAdminAdForm({
        advertiserName: 'NendPlay Media',
        title: '',
        description: '',
        mediaUrl: '',
        targetUrl: '',
        adType: 'banner',
        placement: 'home',
        targetAudience: 'unsubscribed',
        durationDays: 7,
        status: 'active',
      })
      if (activeTab === 'ads') loadTable(1)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not create ad')
    }
  }

  const importAdminDocument = async () => {
    const requiredFields = ['title', 'fileUrl', 'sourceName', 'sourceUrl', 'licenseType']
    if (requiredFields.some((key) => !String(documentImportForm[key] || '').trim())) {
      toast.error('Enter title, PDF URL, source, source URL, and license')
      return
    }
    try {
      await adminService.importDocument({
        ...documentImportForm,
        title: documentImportForm.title.trim(),
        author: documentImportForm.author.trim(),
        category: documentImportForm.category,
        genre: documentImportForm.category,
        fileUrl: documentImportForm.fileUrl.trim(),
        sourceName: documentImportForm.sourceName.trim(),
        sourceUrl: documentImportForm.sourceUrl.trim(),
        licenseUrl: documentImportForm.licenseUrl.trim(),
        coverImage: documentImportForm.coverImage.trim(),
        rightsConfirmed: true,
        isPublicDomain: documentImportForm.licenseType === 'public_domain',
        isCreativeCommons: documentImportForm.licenseType !== 'public_domain',
      })
      toast.success('Legal PDF imported')
      setDocumentImportOpen(false)
      setDocumentImportForm({
        title: '',
        author: '',
        description: '',
        category: 'fiction',
        fileUrl: '',
        coverImage: '',
        sourceName: 'Project Gutenberg',
        sourceUrl: '',
        licenseType: 'public_domain',
        licenseUrl: '',
        attributionText: '',
        rightsSummary: '',
        tags: '',
      })
      if (activeTab === 'documents') loadTable(1)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not import document')
    }
  }

  const columns = useMemo(() => {
    if (activeTab === 'users') return [
      { key: 'name', label: 'User', render: (row) => <div><p className="font-bold">{row.profileName || row.username || 'User'}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.email || row.username}</p></div> },
      { key: 'role', label: 'Role', render: (row) => <Badge>{row.role || 'user'}</Badge> },
      { key: 'isActive', label: 'Status', render: (row) => <Badge>{row.isActive ? 'active' : 'inactive'}</Badge> },
      { key: 'subscriptionPlan', label: 'Plan', render: (row) => row.subscriptionPlan || 'none' },
      { key: 'createdAt', label: 'Joined', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
    if (activeTab === 'media') return [
      { key: 'title', label: 'Title', render: (row) => <div><p className="font-bold max-w-sm truncate">{row.title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.type} · {(row.genres?.length ? row.genres : [row.genre]).filter(Boolean).join(', ') || (row.categories?.length ? row.categories : [row.category]).filter(Boolean).join(', ')}</p></div> },
      { key: 'navigationLabels', label: 'Nav Labels', render: (row) => (row.navigationLabels?.length ? row.navigationLabels : row.homeSections || []).join(', ') || '-' },
      { key: 'publishStatus', label: 'Publish', render: (row) => <Badge>{row.publishStatus}</Badge> },
      { key: 'reviewStatus', label: 'Review', render: (row) => <Badge>{row.reviewStatus || 'pending'}</Badge> },
      { key: 'isActive', label: 'Status', render: (row) => <Badge>{row.isActive ? 'active' : 'inactive'}</Badge> },
      { key: 'viewCount', label: 'Views' },
      { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
    if (activeTab === 'documents') return [
      { key: 'title', label: 'Document', render: (row) => <div><p className="font-bold max-w-sm truncate">{row.title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.fileType} · {row.genre}</p></div> },
      { key: 'author', label: 'Author' },
      { key: 'reviewStatus', label: 'Review', render: (row) => <Badge>{row.reviewStatus || 'pending_review'}</Badge> },
      { key: 'publishStatus', label: 'Publish', render: (row) => <Badge>{row.publishStatus || (row.isActive ? 'published' : 'archived')}</Badge> },
      { key: 'licenseType', label: 'License', render: (row) => row.licenseType || 'unknown' },
      { key: 'sourceName', label: 'Source', render: (row) => row.sourceName || row.contentOrigin || '-' },
      { key: 'downloadCount', label: 'Downloads' },
      { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
    if (activeTab === 'ads') return [
      { key: 'title', label: 'Ad', render: (row) => <div><p className="font-bold max-w-sm truncate">{row.title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.adType} · {row.placement}</p></div> },
      { key: 'advertiserName', label: 'Advertiser' },
      { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
      { key: 'paymentGateway', label: 'Payment', render: (row) => row.paymentGateway === 'admin_comp' ? <Badge>free admin ad</Badge> : <Badge>{row.isPaid ? 'paid' : 'unpaid'}</Badge> },
      { key: 'impressions', label: 'Views' },
      { key: 'clicks', label: 'Clicks' },
    ]
    if (activeTab === 'subscriptions') return [
      { key: 'userId', label: 'User', render: (row) => row.userId?.email || row.userId?.username || 'User' },
      { key: 'plan', label: 'Plan', render: (row) => <Badge>{row.plan}</Badge> },
      { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
      { key: 'priceNaira', label: 'Amount', render: (row) => `₦${Number(row.priceNaira || 0).toLocaleString()}` },
      { key: 'expiryDate', label: 'Expires', render: (row) => row.expiryDate ? new Date(row.expiryDate).toLocaleDateString() : '-' },
    ]
    if (activeTab === 'downloads') return [
      { key: 'userId', label: 'User', render: (row) => row.userId?.email || row.userId?.username || 'User' },
      { key: 'contentSnapshot', label: 'Content', render: (row) => row.contentSnapshot?.title || row.contentType },
      { key: 'platform', label: 'Platform' },
      { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
      { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
    return [
      { key: 'userId', label: 'User', render: (row) => row.userId?.email || row.userId?.username || 'User' },
      { key: 'type', label: 'Type', render: (row) => <Badge>{row.type}</Badge> },
      { key: 'source', label: 'Source' },
      { key: 'coins', label: 'Coins', render: (row) => row.coins > 0 ? `+${row.coins}` : row.coins },
      { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
  }, [activeTab])

  const renderActions = (row) => {
    if (activeTab === 'users') {
      return (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('User status updated', () => adminService.updateUser(row._id, { isActive: !row.isActive }))}>
            {row.isActive ? 'Deactivate' : 'Activate'}
          </button>
          <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1" onClick={() => openMessageModal(row)}>
            <RiMailLine /> Message
          </button>
          {isSuperAdmin && (
            <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1" onClick={() => viewUserDetails(row)}>
              <RiEyeLine /> Details
            </button>
          )}
          {isSuperAdmin && row.role !== 'super_admin' && (
            <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Admin role updated', () => adminService.updateUser(row._id, { role: row.role === 'admin' ? 'user' : 'admin', adminPermissions: dashboard?.permissions || [] }))}>
              {row.role === 'admin' ? 'Remove Admin' : 'Make Admin'}
            </button>
          )}
          {isSuperAdmin && row.id !== user?.id && row._id !== user?.id && (
            <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1"
              style={{ color: '#EF4444' }}
              onClick={() => confirmDelete(`Permanently delete ${row.email || row.username || 'this user'}? This cannot be undone.`, () => adminService.deleteUser(row._id))}>
              <RiDeleteBinLine /> Delete
            </button>
          )}
        </div>
      )
    }
    if (activeTab === 'media') {
      return (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1" onClick={() => setPreviewMedia(row)}>
            <RiEyeLine /> Watch
          </button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => openMediaEditModal(row)}>Edit</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media approved', () => adminService.approveMedia(row._id))}>Approve</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media rejected', () => adminService.rejectMedia(row._id, { reviewNote: 'Rejected by admin review' }))}>Reject</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media archived', () => adminService.updateMedia(row._id, { publishStatus: 'archived', isActive: false }))}>Archive</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Feature updated', () => adminService.updateMedia(row._id, { isFeatured: !row.isFeatured }))}>{row.isFeatured ? 'Unfeature' : 'Feature'}</button>
          <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1"
            style={{ color: '#EF4444' }}
            onClick={() => confirmDelete(`Permanently delete media "${row.title}"? This cannot be undone.`, () => adminService.deleteMedia(row._id))}>
            <RiDeleteBinLine /> Delete
          </button>
        </div>
      )
    }
    if (activeTab === 'documents') {
      return (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Document approved', () => adminService.approveDocument(row._id, { rightsConfirmed: true }))}>Approve</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Document rejected', () => adminService.rejectDocument(row._id, { reviewNote: 'Rejected by admin review' }))}>Reject</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Document status updated', () => adminService.updateDocument(row._id, { isActive: !row.isActive }))}>{row.isActive ? 'Hide' : 'Restore'}</button>
          {isSuperAdmin && (
            <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1"
              style={{ color: '#EF4444' }}
              onClick={() => confirmDelete(`Permanently delete document "${row.title}"? This cannot be undone.`, () => adminService.deleteDocument(row._id))}>
              <RiDeleteBinLine /> Delete
            </button>
          )}
        </div>
      )
    }
    if (activeTab === 'ads') {
      return (
        <div className="flex flex-wrap gap-2">
          <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1" onClick={() => setPreviewAd(row)}>
            <RiEyeLine /> View
          </button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad approved', () => adminService.updateAd(row._id, { status: 'active', durationDays: row.durationDays || 30 }))}>Approve</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad paused', () => adminService.updateAd(row._id, { status: 'paused' }))}>Pause</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad rejected', () => adminService.updateAd(row._id, { status: 'rejected', rejectionReason: 'Rejected by admin review' }))}>Reject</button>
          <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1"
            style={{ color: '#EF4444' }}
            onClick={() => confirmDelete(`Permanently delete ad "${row.title}"? This cannot be undone.`, () => adminService.deleteAd(row._id))}>
            <RiDeleteBinLine /> Delete
          </button>
        </div>
      )
    }
    return null
  }

  if (!isAuthenticated || !isAdmin) return null

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
          style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
          <RiShieldUserLine className="text-2xl" />
        </div>
        <div>
          <h1 className="font-display font-black text-2xl gradient-text sm:text-3xl">Admin Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Full NendPlay operations control center</p>
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto pb-2 no-scrollbar">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setActiveTab(id); setSearch(''); setStatus(''); setPage(1) }}
            className="flex flex-shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold"
            style={{
              background: activeTab === id ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === id ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}>
            <Icon /> {label}
          </button>
        ))}
      </div>

      {loading && <div className="grid grid-cols-1 md:grid-cols-4 gap-4">{[...Array(8)].map((_, i) => <div key={i} className="skeleton h-28 rounded-2xl" />)}</div>}
      {detailsLoading && <div className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>Loading user details...</div>}

      {!loading && activeTab === 'overview' && dashboard && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <StatCard label="Users" value={dashboard.stats.totalUsers} icon={RiUserLine} />
            <StatCard label="Media" value={dashboard.stats.totalMedia} icon={RiFilmLine} />
            <StatCard label="Pending Media" value={dashboard.stats.pendingMedia || 0} icon={RiFilmLine} />
            <StatCard label="NovelHub Docs" value={dashboard.stats.totalDocuments} icon={RiBookOpenLine} />
            <StatCard label="Revenue" value={`₦${Number(dashboard.stats.revenueNaira || 0).toLocaleString()}`} icon={RiVipCrownLine} />
            <StatCard label="Pending Ads" value={dashboard.stats.pendingAds} icon={RiAdvertisementLine} />
            <StatCard label="Active Subs" value={dashboard.stats.activeSubscriptions} icon={RiVipCrownLine} />
            <StatCard label="Downloads" value={dashboard.stats.downloads} icon={RiDownloadLine} />
            <StatCard label="Reward Events" value={dashboard.stats.rewardEvents} icon={RiGiftLine} />
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="card p-5">
              <h2 className="font-black mb-3" style={{ color: 'var(--color-text)' }}>Recent Users</h2>
              {dashboard.recentUsers.map((item) => <p key={item._id} className="py-2 text-sm" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{item.email || item.username || item.profileName} · {item.role}</p>)}
            </div>
            <div className="card p-5">
              <h2 className="font-black mb-3" style={{ color: 'var(--color-text)' }}>Pending Ad Reviews</h2>
              {dashboard.pendingReviewAds.length === 0 ? <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No pending ads.</p> : dashboard.pendingReviewAds.map((item) => <p key={item._id} className="py-2 text-sm" style={{ color: 'var(--color-text-muted)', borderBottom: '1px solid var(--color-border)' }}>{item.title} · {item.advertiserName}</p>)}
            </div>
          </div>
        </div>
      )}

      {!loading && activeTab === 'statistics' && analytics && (
        <StatisticsPanel analytics={analytics} />
      )}

      {!loading && activeTab !== 'overview' && activeTab !== 'statistics' && (
        activeTab === 'notifications' ? (
          <NotificationPanel
            stats={pushStats}
            mode={notificationMode}
            setMode={setNotificationMode}
            form={pushForm}
            setForm={setPushForm}
            imageFile={pushImageFile}
            setImageFile={setPushImageFile}
            sending={pushSending}
            onSend={sendPushNotification}
            inAppForm={inAppForm}
            setInAppForm={setInAppForm}
            inAppImageFile={inAppImageFile}
            setInAppImageFile={setInAppImageFile}
            inAppSending={inAppSending}
            onSendInApp={sendInAppNotification}
            notificationRows={notificationRows}
            notificationLoading={notificationLoading}
            onDeleteNotification={deleteAdminNotification}
            onRefreshNotifications={() => loadAdminNotifications(true)}
          />
        ) : activeTab === 'news' ? (
          <NewsPanel
            articles={newsRows}
            meta={newsMeta}
            filters={newsFilters}
            setFilters={setNewsFilters}
            search={search}
            setSearch={setSearch}
            onRefresh={() => loadNews(1)}
            pagination={pagination}
            page={page}
            onPage={loadNews}
          />
        ) : (
        <div className="space-y-4">
          <TableShell
            title={tabs.find((tab) => tab.id === activeTab)?.label}
            search={search}
            setSearch={setSearch}
            filters={
              <>
                {activeTab === 'media' && (
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    disabled={bunnySyncing}
                    onClick={syncBunnyLibrary}
                  >
                    {bunnySyncing ? 'Syncing Bunny...' : 'Sync Bunny'}
                  </button>
                )}
                {activeTab === 'ads' && (
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => setAdminAdFormOpen(true)}
                  >
                    Create Free Ad
                  </button>
                )}
                {activeTab === 'documents' && (
                  <button
                    type="button"
                    className="btn-primary px-4 py-2 text-sm"
                    onClick={() => setDocumentImportOpen(true)}
                  >
                    Import Legal PDF
                  </button>
                )}
                <select className="input-base py-2" value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="pending_review">Pending Review</option>
                  <option value="published">Published</option>
                  <option value="rejected">Rejected</option>
                  <option value="archived">Archived</option>
                  <option value="failed">Failed</option>
                </select>
              </>
            }>
            <DataTable columns={columns} rows={rows} renderActions={['users', 'media', 'documents', 'ads'].includes(activeTab) ? renderActions : null} />
          </TableShell>
          {pagination && (
            <div className="flex items-center justify-between">
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Page {pagination.page} of {pagination.pages} · {pagination.total} total</p>
              <div className="flex gap-2">
                <button className="btn-ghost px-4 py-2 text-sm" disabled={page <= 1} onClick={() => loadTable(page - 1)}>Previous</button>
                <button className="btn-ghost px-4 py-2 text-sm" disabled={page >= pagination.pages} onClick={() => loadTable(page + 1)}>Next</button>
              </div>
            </div>
          )}
        </div>
        )
      )}

      {adminAdFormOpen && (
        <AdminAdModal
          form={adminAdForm}
          setForm={setAdminAdForm}
          file={adminAdFile}
          setFile={setAdminAdFile}
          onClose={() => setAdminAdFormOpen(false)}
          onSubmit={createAdminAd}
        />
      )}

      {documentImportOpen && (
        <DocumentImportModal
          form={documentImportForm}
          setForm={setDocumentImportForm}
          onClose={() => setDocumentImportOpen(false)}
          onSubmit={importAdminDocument}
        />
      )}

      {selectedUserDetails && (
        <UserDetailsModal
          details={selectedUserDetails}
          onClose={() => setSelectedUserDetails(null)}
        />
      )}

      {messageTarget && (
        <MessageUserModal
          user={messageTarget}
          form={messageForm}
          setForm={setMessageForm}
          onClose={() => setMessageTarget(null)}
          onSend={sendUserMessage}
        />
      )}

      {mediaEditTarget && mediaEditForm && (
        <MediaEditModal
          media={mediaEditTarget}
          form={mediaEditForm}
          setForm={setMediaEditForm}
          thumbnailFile={mediaThumbnailFile}
          setThumbnailFile={setMediaThumbnailFile}
          onClose={() => {
            setMediaEditTarget(null)
            setMediaEditForm(null)
            setMediaThumbnailFile(null)
          }}
          onSave={saveMediaEdit}
        />
      )}

      {previewMedia && (
        <MediaPreviewModal media={previewMedia} onClose={() => setPreviewMedia(null)} />
      )}

      {previewAd && (
        <AdPreviewModal ad={previewAd} onClose={() => setPreviewAd(null)} />
      )}
    </div>
  )
}

function DocumentImportModal({ form, setForm, onClose, onSubmit }) {
  const update = (key, value) => setForm({ ...form, [key]: value })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>Import Legal PDF</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Use only public-domain, Creative Commons, government, educational, or rights-cleared books.
            </p>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="input-base" placeholder="Title" value={form.title} onChange={(event) => update('title', event.target.value)} />
            <input className="input-base" placeholder="Author" value={form.author} onChange={(event) => update('author', event.target.value)} />
            <select className="input-base" value={form.category} onChange={(event) => update('category', event.target.value)}>
              {NOVEL_GENRE_OPTIONS.map((genre) => <option key={genre} value={genre}>{genre}</option>)}
            </select>
            <input className="input-base" placeholder="Cover image URL" value={form.coverImage} onChange={(event) => update('coverImage', event.target.value)} />
          </div>

          <textarea className="input-base min-h-24 resize-y" placeholder="Description" value={form.description} onChange={(event) => update('description', event.target.value)} />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input className="input-base" placeholder="PDF file URL" value={form.fileUrl} onChange={(event) => update('fileUrl', event.target.value)} />
            <input className="input-base" placeholder="Original source URL" value={form.sourceUrl} onChange={(event) => update('sourceUrl', event.target.value)} />
            <select className="input-base" value={form.sourceName} onChange={(event) => update('sourceName', event.target.value)}>
              {TRUSTED_DOCUMENT_SOURCE_OPTIONS.map((source) => <option key={source} value={source}>{source}</option>)}
            </select>
            <select className="input-base" value={form.licenseType} onChange={(event) => update('licenseType', event.target.value)}>
              {DOCUMENT_LICENSE_OPTIONS.map((license) => <option key={license} value={license}>{license}</option>)}
            </select>
            <input className="input-base" placeholder="License URL" value={form.licenseUrl} onChange={(event) => update('licenseUrl', event.target.value)} />
            <input className="input-base" placeholder="Tags, comma separated" value={form.tags} onChange={(event) => update('tags', event.target.value)} />
          </div>

          <textarea className="input-base min-h-20 resize-y" placeholder="Attribution text" value={form.attributionText} onChange={(event) => update('attributionText', event.target.value)} />
          <textarea className="input-base min-h-20 resize-y" placeholder="Rights summary / verification note" value={form.rightsSummary} onChange={(event) => update('rightsSummary', event.target.value)} />

          <div
            className="rounded-2xl px-4 py-3 text-sm"
            style={{ background: 'rgba(251,191,36,0.12)', color: '#FBBF24', border: '1px solid rgba(251,191,36,0.24)' }}
          >
            Importing confirms NendPlay has permission to list this PDF. Trusted public-domain and Creative Commons imports publish immediately; other submissions must be approved.
          </div>

          <div className="flex justify-end gap-2">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
            <button className="btn-primary px-4 py-2 text-sm" onClick={onSubmit}>Import PDF</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function AdminAdModal({ form, setForm, file, setFile, onClose, onSubmit }) {
  const adTypes = ['banner', 'video', 'overlay']
  const placements = ['home', 'media', 'news', 'downloads', 'profile', 'subscription', 'live_event', 'novels', 'shorts', 'all']
  const statuses = ['active', 'pending_review', 'paused', 'rejected']
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : form.mediaUrl || ''), [file, form.mediaUrl])
  const isVideo = file?.type?.startsWith('video/') || /\.(mp4|webm|mov|m3u8)(\?|$)/i.test(previewUrl)

  useEffect(() => {
    return () => {
      if (file && previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [file, previewUrl])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>Create Free Admin Ad</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Admin-created ads skip payment and can go active immediately.</p>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Close</button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-[260px,1fr] gap-5">
          <div>
            <div className="aspect-video overflow-hidden rounded-2xl flex items-center justify-center" style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
              {previewUrl ? (
                isVideo ? (
                  <video src={previewUrl} controls className="h-full w-full object-cover" />
                ) : (
                  <img src={previewUrl} alt="" className="h-full w-full object-cover" />
                )
              ) : (
                <RiAdvertisementLine className="text-5xl" />
              )}
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
              className="input-base mt-3"
              onChange={(event) => setFile(event.target.files?.[0] || null)}
            />
            {file && (
              <button type="button" className="btn-ghost mt-2 px-3 py-2 text-xs" onClick={() => setFile(null)}>
                Remove file
              </button>
            )}
          </div>

          <div className="space-y-3">
            <input className="input-base" placeholder="Advertiser name" value={form.advertiserName} onChange={(event) => setForm({ ...form, advertiserName: event.target.value })} />
            <input className="input-base" placeholder="Ad title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            <textarea className="input-base min-h-24 resize-y" placeholder="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
            <input className="input-base" placeholder="Target URL" value={form.targetUrl} onChange={(event) => setForm({ ...form, targetUrl: event.target.value })} />
            <input className="input-base" placeholder="Media URL if not uploading a file" value={form.mediaUrl} onChange={(event) => setForm({ ...form, mediaUrl: event.target.value })} />
            <div
              className="rounded-2xl px-4 py-3 text-sm font-black"
              style={{
                background: 'rgba(34,197,94,0.12)',
                color: '#22C55E',
                border: '1px solid rgba(34,197,94,0.28)',
              }}
            >
              Payment: Free admin ad. Backend will save this as admin_comp automatically.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select className="input-base" value={form.adType} onChange={(event) => setForm({ ...form, adType: event.target.value })}>
                {adTypes.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select className="input-base" value={form.placement} onChange={(event) => setForm({ ...form, placement: event.target.value })}>
                {placements.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select className="input-base" value={form.targetAudience} onChange={(event) => setForm({ ...form, targetAudience: event.target.value })}>
                <option value="unsubscribed">Unsubscribed users</option>
                <option value="all">Everyone</option>
              </select>
              <select className="input-base" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input className="input-base" type="number" min="1" max="365" value={form.durationDays} onChange={(event) => setForm({ ...form, durationDays: event.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Cancel</button>
              <button className="btn-primary px-4 py-2 text-sm" onClick={onSubmit}>Create Free Ad</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MediaPreviewModal({ media, onClose }) {
  const mediaUrl = media.hlsUrl || media.playbackUrl || media.mediaUrl
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.76)' }}>
      <div className="card w-full max-w-4xl overflow-hidden">
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text)' }}>{media.title}</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {media.type} · {media.publishStatus} · {media.reviewStatus || 'pending'}
            </p>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-4">
          {mediaUrl ? (
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <ReactPlayer url={mediaUrl} controls playing={false} width="100%" height="100%" />
            </div>
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              No playable URL is available for this media yet.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function AdPreviewModal({ ad, onClose }) {
  const isVideo = ad.adType === 'video' || /\.(mp4|webm|m3u8)(\?|$)/i.test(ad.mediaUrl || '')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.76)' }}>
      <div className="card w-full max-w-3xl overflow-hidden">
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text)' }}>{ad.title}</h2>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {ad.adType} · {ad.placement} · {ad.status}
            </p>
          </div>
          <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>Close</button>
        </div>
        <div className="p-4 space-y-4">
          {ad.mediaUrl ? (
            isVideo ? (
              <div className="aspect-video overflow-hidden rounded-2xl bg-black">
                <ReactPlayer url={ad.mediaUrl} controls playing={false} width="100%" height="100%" />
              </div>
            ) : (
              <img src={ad.mediaUrl} alt={ad.title} className="max-h-[420px] w-full rounded-2xl object-contain" />
            )
          ) : (
            <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
              This ad has no media file attached.
            </div>
          )}
          <div>
            <p className="font-black" style={{ color: 'var(--color-text)' }}>{ad.advertiserName}</p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{ad.description || 'No description'}</p>
            {ad.targetUrl && <a href={ad.targetUrl} target="_blank" rel="noreferrer" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>Open target URL</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

function MediaEditModal({ media, form, setForm, thumbnailFile, setThumbnailFile, onClose, onSave }) {
  const applyOption = (field, value) => {
    const list = normalizeInputList(form[field])
    const exists = list.some((item) => item.toLowerCase() === value.toLowerCase())
    const next = exists ? list.filter((item) => item.toLowerCase() !== value.toLowerCase()) : [...list, value].slice(0, 5)
    setForm({ ...form, [field]: next.join(', ') })
  }
  const selectedGenreLabels = normalizeInputList(form.genres)
  const pinGenreOptions = [
    ...selectedGenreLabels,
    ...MOVIE_GENRE_OPTIONS.filter((item) => !selectedGenreLabels.some((selected) => normalizeGenrePinKey(selected) === normalizeGenrePinKey(item))),
  ]
  const updateGenrePin = (genre, position) => {
    const key = normalizeGenrePinKey(genre)
    const nextPins = { ...(form.genrePins || {}) }
    if (!position) delete nextPins[key]
    else nextPins[key] = Number(position)
    setForm({ ...form, genrePins: nextPins })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="card w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>Edit Media</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Edit before or after approval. If no thumbnail is provided, NendPlay uses the provider thumbnail where available.
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Close</button>
        </div>

        <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Title</label>
            <input className="input-base" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Type</label>
            <select className="input-base" value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>
              {MEDIA_TYPE_OPTIONS.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Description</label>
            <textarea className="input-base min-h-28 resize-y" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Title Structure</label>
            <select className="input-base" value={form.collectionType} onChange={(event) => setForm({ ...form, collectionType: event.target.value })}>
              {COLLECTION_TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          {form.collectionType !== 'single' && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Series/Movie Title</label>
              <input className="input-base" value={form.parentTitle} onChange={(event) => setForm({ ...form, parentTitle: event.target.value })} placeholder="Example: The Blacklist" />
            </div>
          )}

          {form.collectionType === 'movie_part' && (
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Part Number</label>
              <input className="input-base" type="number" min="1" value={form.partNumber} onChange={(event) => setForm({ ...form, partNumber: event.target.value })} />
            </div>
          )}

          {form.collectionType === 'series_episode' && (
            <>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Season Number</label>
                <input className="input-base" type="number" min="0" value={form.seasonNumber} onChange={(event) => setForm({ ...form, seasonNumber: event.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Episode Number</label>
                <input className="input-base" type="number" min="1" value={form.episodeNumber} onChange={(event) => setForm({ ...form, episodeNumber: event.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Episode Title</label>
                <input className="input-base" value={form.episodeTitle} onChange={(event) => setForm({ ...form, episodeTitle: event.target.value })} placeholder="Optional episode name" />
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Categories, max 5</label>
            <input className="input-base" value={form.categories} onChange={(event) => setForm({ ...form, categories: event.target.value })} placeholder="Hollywood, Nollywood" />
            <div className="mt-2 flex flex-wrap gap-2">
              {MEDIA_CATEGORY_OPTIONS.map((item) => (
                <button key={item} type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => applyOption('categories', item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Navigation Labels, max 5</label>
            <input className="input-base" value={form.navigationLabels} onChange={(event) => setForm({ ...form, navigationLabels: event.target.value })} placeholder="Trending, Movie" />
            <div className="mt-2 flex flex-wrap gap-2">
              {MEDIA_NAVIGATION_OPTIONS.map((item) => (
                <button key={item} type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => applyOption('navigationLabels', item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Genres (up to 5)</label>
            <input className="input-base" value={form.genres} onChange={(event) => setForm({ ...form, genres: event.target.value })} placeholder="Action, Adventure, Drama" />
            <div className="mt-2 flex flex-wrap gap-2">
              {MOVIE_GENRE_OPTIONS.map((item) => (
                <button key={item} type="button" className="btn-ghost px-3 py-1 text-xs" onClick={() => applyOption('genres', item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Pin In Genre Rows</label>
            <div className="rounded-xl p-3 space-y-2" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
              <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                Choose position 1-4 to keep this media fixed in that genre. Other media in the genre will keep shuffling.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {pinGenreOptions.map((genre) => {
                  const key = normalizeGenrePinKey(genre)
                  return (
                    <label key={key} className="flex items-center justify-between gap-2 text-xs font-bold" style={{ color: 'var(--color-text)' }}>
                      <span className="truncate">{genre}</span>
                      <select
                        className="input-base py-1 text-xs"
                        style={{ width: 105 }}
                        value={form.genrePins?.[key] || ''}
                        onChange={(event) => updateGenrePin(genre, event.target.value)}
                      >
                        <option value="">Shuffle</option>
                        <option value="1">#1</option>
                        <option value="2">#2</option>
                        <option value="3">#3</option>
                        <option value="4">#4</option>
                      </select>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Language</label>
            <input className="input-base" value={form.language} onChange={(event) => setForm({ ...form, language: event.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Country</label>
            <input className="input-base" value={form.country} onChange={(event) => setForm({ ...form, country: event.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Featured Rank</label>
            <input className="input-base" type="number" value={form.featuredRank} onChange={(event) => setForm({ ...form, featuredRank: event.target.value })} />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Publish Status</label>
            <select className="input-base" value={form.publishStatus} onChange={(event) => setForm({ ...form, publishStatus: event.target.value })}>
              {PUBLISH_STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Review Status</label>
            <select className="input-base" value={form.reviewStatus} onChange={(event) => setForm({ ...form, reviewStatus: event.target.value })}>
              <option value="pending">pending</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
            </select>
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Review Note</label>
            <textarea className="input-base min-h-20 resize-y" value={form.reviewNote} onChange={(event) => setForm({ ...form, reviewNote: event.target.value })} />
          </div>

          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-[180px,1fr] gap-4 items-center">
            <div className="h-28 rounded-xl overflow-hidden" style={{ background: 'var(--color-surface-high)' }}>
              {form.thumbnailUrl || media.thumbnailUrl ? (
                <img src={form.thumbnailUrl || media.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No thumbnail</div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Replace Thumbnail</label>
              <input className="input-base" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setThumbnailFile(event.target.files?.[0] || null)} />
              <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                {thumbnailFile ? thumbnailFile.name : 'Leave empty to keep the existing thumbnail or provider-generated thumbnail.'}
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-wrap gap-4">
            {[
              ['isLocked', 'Subscription locked'],
              ['isActive', 'Visible/active'],
              ['isFeatured', 'Featured'],
            ].map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
                <input type="checkbox" checked={Boolean(form[key])} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className="p-5 flex justify-end gap-2" style={{ borderTop: '1px solid var(--color-border)' }}>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
          <button onClick={onSave} className="btn-primary px-5 py-2 text-sm">Save Media</button>
        </div>
      </div>
    </div>
  )
}

function NewsPanel({ articles, meta, filters, setFilters, search, setSearch, onRefresh, pagination, page, onPage }) {
  const updatedAt = meta?.updatedAt ? new Date(meta.updatedAt).toLocaleString() : ''
  const emptyPostForm = {
    section: 'news',
    jobMode: 'on-site',
    header: '',
    subHeader: '',
    body: '',
    categories: ['headlines'],
    adsEnabled: true,
    status: 'published',
  }
  const [postForm, setPostForm] = useState({
    section: 'news',
    jobMode: 'on-site',
    header: '',
    subHeader: '',
    body: '',
    categories: ['headlines'],
    adsEnabled: true,
    status: 'published',
  })
  const [postFiles, setPostFiles] = useState([])
  const [posting, setPosting] = useState(false)
  const [editingPost, setEditingPost] = useState(null)
  const categoryOptions = (postForm.section === 'career' ? CAREER_CATEGORY_OPTIONS : NEWS_TAB_OPTIONS
    .filter((option) => !['for-you'].includes(option.value))
    .map((option) => ({ ...option, value: option.value.toLowerCase() })))

  const togglePostCategory = (value) => {
    setPostForm((current) => {
      const selected = current.categories || []
      if (selected.includes(value)) {
        return { ...current, categories: selected.filter((item) => item !== value) }
      }
      if (selected.length >= 5) {
        toast.error('A news post can have up to 5 categories')
        return current
      }
      return { ...current, categories: [...selected, value] }
    })
  }

  const selectedFileStats = useMemo(() => {
    const videos = postFiles.filter((file) => file.type?.startsWith('video/')).length
    const audio = postFiles.filter((file) => file.type?.startsWith('audio/')).length
    const pictures = postFiles.filter((file) => file.type?.startsWith('image/')).length
    return { videos, audio, pictures }
  }, [postFiles])

  const resetPostForm = () => {
    setPostForm(emptyPostForm)
    setPostFiles([])
    setEditingPost(null)
  }

  const startEditingPost = (article) => {
    setEditingPost(article)
    setPostForm({
      section: article.section || 'news',
      jobMode: article.jobMode || 'on-site',
      header: article.header || article.title || '',
      subHeader: article.subHeader || '',
      body: article.body || article.summary || '',
      categories: (article.categories?.length ? article.categories : [article.category || 'headlines'])
        .map((item) => String(item).toLowerCase()),
      adsEnabled: article.adsEnabled !== false,
      status: article.status || 'published',
    })
    setPostFiles([])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const submitPost = async () => {
    if (!postForm.header.trim() || !postForm.body.trim()) {
      toast.error('Header and body text are required')
      return
    }
    if (!postForm.categories.length) {
      toast.error('Choose at least one category')
      return
    }
    if (selectedFileStats.videos > 5 || selectedFileStats.audio > 5 || selectedFileStats.pictures > 5) {
      toast.error('Choose up to 5 videos, 5 audio files, and 5 pictures')
      return
    }

    const data = new FormData()
    data.append('header', postForm.header)
    data.append('section', postForm.section || 'news')
    data.append('jobMode', postForm.section === 'career' ? postForm.jobMode : '')
    data.append('subHeader', postForm.subHeader)
    data.append('body', postForm.body)
    data.append('categories', postForm.categories.join(','))
    data.append('adsEnabled', String(postForm.adsEnabled))
    data.append('status', postForm.status)
    postFiles.forEach((file) => data.append('media', file))

    setPosting(true)
    try {
      if (editingPost) {
        await adminService.updateNewsPost(editingPost.id || editingPost._id, data)
        toast.success('News updated')
      } else {
        await adminService.createNewsPost(data)
        toast.success('News posted')
      }
      resetPostForm()
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.message || (editingPost ? 'Could not update news' : 'Could not post news'))
    } finally {
      setPosting(false)
    }
  }

  const deletePost = async (article) => {
    const title = article.header || article.title || 'this news post'
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      await adminService.deleteNewsPost(article.id || article._id)
      toast.success('News deleted')
      if (editingPost && String(editingPost.id || editingPost._id) === String(article.id || article._id)) {
        resetPostForm()
      }
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete news')
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              {editingPost ? 'Edit NendPlay Post' : 'Post to NendPlay Hub'}
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Publish and manage admin-created news with up to 5 videos, 5 pictures, body text, comments, sharing, and in-article ad placement.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>{NEWS_SECTION_OPTIONS.find((item) => item.value === postForm.section)?.label || 'News'}</Badge>
            <Badge>{postForm.categories.length}/5 categories</Badge>
          </div>
        </div>

        <div className="mt-4">
          <p className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Post to</p>
          <div className="flex flex-wrap gap-2">
            {NEWS_SECTION_OPTIONS.map((option) => {
              const selected = postForm.section === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setPostForm({
                    ...postForm,
                    section: option.value,
                    jobMode: option.value === 'career' ? (postForm.jobMode || 'on-site') : '',
                    categories: option.value === 'career' ? ['information technology'] : ['headlines'],
                  })}
                  className="px-4 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: selected ? 'var(--color-primary)' : 'var(--color-surface-high)',
                    color: selected ? '#fff' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        {postForm.section === 'career' && (
          <div className="mt-4">
            <p className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Career job type</p>
            <div className="flex flex-wrap gap-2">
              {CAREER_JOB_MODE_OPTIONS.map((option) => {
                const selected = postForm.jobMode === option.value
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setPostForm({ ...postForm, jobMode: option.value })}
                    className="px-4 py-2 rounded-xl text-sm font-bold"
                    style={{
                      background: selected ? 'var(--color-primary)' : 'var(--color-surface-high)',
                      color: selected ? '#fff' : 'var(--color-text-muted)',
                      border: '1px solid var(--color-border)',
                    }}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <input
            className="input-base"
            placeholder="Header"
            value={postForm.header}
            onChange={(event) => setPostForm({ ...postForm, header: event.target.value })}
          />
          <input
            className="input-base"
            placeholder="Sub-header"
            value={postForm.subHeader}
            onChange={(event) => setPostForm({ ...postForm, subHeader: event.target.value })}
          />
          <textarea
            className="input-base lg:col-span-2 min-h-[160px]"
            placeholder="Body text. Ads will be displayed between paragraphs where available."
            value={postForm.body}
            onChange={(event) => setPostForm({ ...postForm, body: event.target.value })}
          />
        </div>

        <div className="mt-4">
          <p className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>
            {postForm.section === 'career' ? 'Career categories' : 'Categories'}
          </p>
          <div className="flex flex-wrap gap-2">
            {categoryOptions.map((option) => {
              const selected = postForm.categories.includes(option.value)
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => togglePostCategory(option.value)}
                  className="px-3 py-2 rounded-xl text-sm font-bold"
                  style={{
                    background: selected ? 'var(--color-primary)' : 'var(--color-surface-high)',
                    color: selected ? '#fff' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_auto_auto] gap-3 items-center">
          <input
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            className="input-base"
            onChange={(event) => {
              const files = Array.from(event.target.files || [])
              const videos = files.filter((file) => file.type?.startsWith('video/')).length
              const audio = files.filter((file) => file.type?.startsWith('audio/')).length
              const pictures = files.filter((file) => file.type?.startsWith('image/')).length
              if (videos > 5 || audio > 5 || pictures > 5) {
                toast.error('Choose up to 5 videos, 5 audio files, and 5 pictures')
                event.target.value = ''
                return
              }
              setPostFiles(files)
            }}
          />
          <select
            className="input-base"
            value={postForm.status}
            onChange={(event) => setPostForm({ ...postForm, status: event.target.value })}
          >
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              checked={postForm.adsEnabled}
              onChange={(event) => setPostForm({ ...postForm, adsEnabled: event.target.checked })}
            />
            Ads between text
          </label>
          <div className="flex gap-2">
            {editingPost && (
              <button className="btn-ghost px-4 py-3 text-sm" disabled={posting} onClick={resetPostForm}>
                Cancel Edit
              </button>
            )}
            <button className="btn-primary px-5 py-3 text-sm" disabled={posting} onClick={submitPost}>
              {posting ? 'Saving...' : editingPost ? 'Save News' : 'Post News'}
            </button>
          </div>
        </div>

        {postFiles.length > 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {postFiles.length} file(s) selected: {selectedFileStats.videos}/5 videos, {selectedFileStats.audio}/5 audio, {selectedFileStats.pictures}/5 pictures. Media displays as header, sub-header, video, audio, pictures, then body text.
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              Posted News Control
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              View, search, edit, and delete every NendPlay news post created by super-admins or admins.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{meta?.source || 'nendplay'}</Badge>
            {updatedAt && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Updated {updatedAt}</span>}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {NEWS_SECTION_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-black whitespace-nowrap"
              onClick={() => setFilters({
                ...filters,
                section: option.value,
                tab: 'for-you',
                jobMode: option.value === 'career' ? (filters.jobMode || 'on-site') : '',
              })}
              style={{
                background: filters.section === option.value ? 'var(--color-primary)' : 'var(--color-surface-high)',
                color: filters.section === option.value ? '#fff' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        {filters.section === 'career' && (
          <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap"
              onClick={() => setFilters({ ...filters, jobMode: '' })}
              style={{
                background: !filters.jobMode ? 'var(--color-primary)' : 'var(--color-surface-high)',
                color: !filters.jobMode ? '#fff' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              All Jobs
            </button>
            {CAREER_JOB_MODE_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap"
                onClick={() => setFilters({ ...filters, jobMode: option.value })}
                style={{
                  background: filters.jobMode === option.value ? 'var(--color-primary)' : 'var(--color-surface-high)',
                  color: filters.jobMode === option.value ? '#fff' : 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        )}

        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {(filters.section === 'career'
            ? [{ value: 'for-you', label: 'All Categories' }, ...CAREER_CATEGORY_OPTIONS]
            : NEWS_TAB_OPTIONS
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              className="px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap"
              onClick={() => setFilters({ ...filters, tab: option.value })}
              style={{
                background: filters.tab === option.value ? 'var(--color-primary)' : 'var(--color-surface-high)',
                color: filters.tab === option.value ? '#fff' : 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
              }}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
          <input
            className="input-base"
            placeholder="Search news..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <button type="button" className="btn-primary px-4 py-3 text-sm" onClick={onRefresh}>
            Refresh News
          </button>
        </div>
      </div>

      {articles.length === 0 ? (
        <div className="card p-8 text-center">
          <RiNewspaperLine className="mx-auto text-4xl mb-3" style={{ color: 'var(--color-primary)' }} />
          <h3 className="font-black text-xl" style={{ color: 'var(--color-text)' }}>No news found</h3>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>Try another tab, search term, or location.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {articles.map((article, index) => (
            <article key={article.id || `${article.title}-${index}`} className="card overflow-hidden">
              {article.imageUrl && (
                <div className="aspect-video overflow-hidden" style={{ background: 'var(--color-surface-high)' }}>
                  <img src={article.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--color-primary)' }}>
                    {article.source || 'News source'}
                  </p>
                  <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {article.publishedAt ? new Date(article.publishedAt).toLocaleString() : 'No date'}
                  </span>
                </div>
                <h3 className="font-black text-lg leading-snug" style={{ color: 'var(--color-text)' }}>
                  {article.title}
                </h3>
                <p className="mt-2 text-sm line-clamp-3" style={{ color: 'var(--color-text-muted)' }}>
                  {article.summary}
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {(article.categories?.length ? article.categories : [article.category || filters.tab]).map((category) => (
                      <Badge key={category}>{category}</Badge>
                    ))}
                    <Badge>{NEWS_SECTION_OPTIONS.find((item) => item.value === (article.section || 'news'))?.label || 'News'}</Badge>
                    <Badge>{article.status || 'published'}</Badge>
                  </div>
                  <div className="flex gap-2">
                    <button className="btn-ghost px-4 py-2 text-sm" type="button" onClick={() => startEditingPost(article)}>
                      Edit
                    </button>
                    <button className="btn-ghost px-4 py-2 text-sm" type="button" onClick={() => deletePost(article)}>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {pagination && (
        <div className="flex items-center justify-between">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Page {pagination.page} of {pagination.pages} · {pagination.total} stories
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost px-4 py-2 text-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</button>
            <button className="btn-ghost px-4 py-2 text-sm" disabled={page >= pagination.pages} onClick={() => onPage(page + 1)}>Next</button>
          </div>
        </div>
      )}
    </div>
  )
}

function NotificationPanel({
  stats,
  mode,
  setMode,
  form,
  setForm,
  imageFile,
  setImageFile,
  sending,
  onSend,
  inAppForm,
  setInAppForm,
  inAppImageFile,
  setInAppImageFile,
  inAppSending,
  onSendInApp,
  notificationRows = [],
  notificationLoading = false,
  onDeleteNotification,
  onRefreshNotifications,
}) {
  const isPush = mode === 'push'
  const isPopup = mode === 'popup'
  const activeForm = isPush ? form : inAppForm
  const setActiveForm = isPush ? setForm : setInAppForm
  const activeImageFile = isPush ? imageFile : inAppImageFile
  const setActiveImageFile = isPush ? setImageFile : setInAppImageFile
  const activeSending = isPush ? sending : inAppSending
  const activeSend = isPush ? onSend : onSendInApp
  const imagePreview = useMemo(() => (activeImageFile ? URL.createObjectURL(activeImageFile) : ''), [activeImageFile])

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <StatCard label="Total Tokens" value={stats?.totalTokens || 0} icon={RiNotification3Line} />
        <StatCard label="Active Tokens" value={stats?.activeTokens || 0} icon={RiNotification3Line} />
        <StatCard label="Reachable Users" value={stats?.usersWithTokens || 0} icon={RiUserLine} />
        <StatCard label="Admin Tokens" value={stats?.adminActiveTokens || 0} icon={RiShieldUserLine} />
        <StatCard label="Bell Notices" value={stats?.inApp?.bell || stats?.inApp?.active || 0} icon={RiNotification3Line} />
        <StatCard label="Pop-ups" value={stats?.inApp?.popup || 0} icon={RiNotification3Line} />
      </div>

      <div className="card p-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { id: 'push', label: 'Push Notifications' },
            { id: 'in-app', label: 'Notifications' },
            { id: 'popup', label: 'Pop-up Messages' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setMode(item.id)}
              className="px-4 py-2 rounded-xl text-sm font-black"
              style={{
                background: mode === item.id ? 'var(--color-primary)' : 'var(--color-surface-high)',
                color: mode === item.id ? '#fff' : 'var(--color-text-muted)',
              }}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="mb-5">
          <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
            {isPush ? 'Send Push Notification' : isPopup ? 'Send Pop-up Message' : 'Send Bell Notification'}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {isPush
              ? 'Send updates to everyone who allowed mobile notifications, including guests, users, admins, and super-admins.'
              : isPopup
                ? 'Show a pop-up message to everyone who opens NendPlay, including guests, users, admins, and super-admins.'
              : 'Send an in-app notification that appears when users tap the bell icon in NendPlay.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Audience</label>
            <select
              className="input-base"
              value={isPopup ? 'all' : activeForm.audience}
              disabled={isPopup}
              onChange={(event) => setActiveForm({ ...activeForm, audience: event.target.value })}
            >
              <option value="all">{isPush || isPopup ? 'Guests + users + admins' : 'All registered users + admins'}</option>
              {!isPush && !isPopup && <option value="admins">Admins only</option>}
              {!isPopup && <option value="subscribers">Subscribed users</option>}
              {!isPopup && <option value="free_users">Free users</option>}
              {!isPopup && <option value="user">One user ID</option>}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Open Screen</label>
            <select
              className="input-base"
              value={activeForm.screen}
              onChange={(event) => setActiveForm({ ...activeForm, screen: event.target.value })}
            >
              <option value="Home">Home</option>
              <option value="Shorts">Shorts</option>
              <option value="NovelHub">NovelHub</option>
              <option value="News">News</option>
              <option value="Rewards">Rewards</option>
              <option value="Subscription">Subscription</option>
              <option value="Downloads">Downloads</option>
              <option value="Profile">Profile</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Linked Content</label>
            <select
              className="input-base"
              value={activeForm.contentType || ''}
              onChange={(event) => {
                const contentType = event.target.value
                setActiveForm({
                  ...activeForm,
                  contentType,
                  contentId: '',
                  screen: contentType === 'news' ? 'News' : contentType === 'media' ? 'Home' : activeForm.screen,
                })
              }}
            >
              <option value="">No linked content</option>
              <option value="news">News post</option>
              <option value="media">Media file</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>
              {activeForm.contentType === 'news' ? 'News ID' : activeForm.contentType === 'media' ? 'Media ID' : 'Content ID'}
            </label>
            <input
              className="input-base"
              value={activeForm.contentId || ''}
              disabled={!activeForm.contentType}
              onChange={(event) => setActiveForm({ ...activeForm, contentId: event.target.value })}
              placeholder={activeForm.contentType ? 'Paste the content ID to open from notification' : 'Choose linked content first'}
            />
          </div>

          {!isPopup && activeForm.audience === 'user' && (
            <div className="lg:col-span-2">
              <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>User ID</label>
              <input
                className="input-base"
                value={activeForm.userId}
                onChange={(event) => setActiveForm({ ...activeForm, userId: event.target.value })}
                placeholder="MongoDB user ID"
              />
            </div>
          )}

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Title</label>
            <input
              className="input-base"
              maxLength={isPush ? 80 : 120}
              value={activeForm.title}
              onChange={(event) => setActiveForm({ ...activeForm, title: event.target.value })}
              placeholder="New release on NendPlay"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Message</label>
            <textarea
              className="input-base min-h-32 resize-y"
              maxLength={isPush ? 180 : 800}
              value={activeForm.body}
              onChange={(event) => setActiveForm({ ...activeForm, body: event.target.value })}
              placeholder="Tell users what is new..."
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Notification Image</label>
            <div className="grid grid-cols-1 md:grid-cols-[220px,1fr] gap-4 items-center">
              <div className="aspect-video rounded-2xl overflow-hidden flex items-center justify-center" style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
                {imagePreview ? (
                  <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                ) : (
                  <RiNewspaperLine className="text-4xl" />
                )}
              </div>
              <div>
                <input
                  className="input-base"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => setActiveImageFile(event.target.files?.[0] || null)}
                />
                <p className="mt-2 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Optional. Use JPEG, PNG, or WebP. The image is uploaded securely and attached to the notification.
                </p>
                {activeImageFile && (
                  <button type="button" className="btn-ghost px-3 py-2 text-xs mt-3" onClick={() => setActiveImageFile(null)}>
                    Remove image
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            className="btn-primary px-5 py-3 text-sm flex items-center gap-2"
            disabled={activeSending}
            onClick={activeSend}
          >
            <RiNotification3Line /> {activeSending ? 'Sending...' : isPush ? 'Send Push' : isPopup ? 'Send Pop-up' : 'Send Notification'}
          </button>
        </div>
      </div>

      <div className="card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              Sent Notifications
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Delete bell notifications or pop-up messages from users at any time.
            </p>
          </div>
          <button type="button" className="btn-ghost px-4 py-2 text-sm" onClick={onRefreshNotifications}>
            Refresh
          </button>
        </div>

        {notificationLoading ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Loading sent notifications...</p>
        ) : notificationRows.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No sent notifications yet.</p>
        ) : (
          <div className="space-y-3">
            {notificationRows.map((item) => (
              <div
                key={item._id}
                className="rounded-2xl p-4 flex flex-col md:flex-row md:items-center gap-4"
                style={{ background: 'var(--color-surface-high)', border: '1px solid var(--color-border)' }}
              >
                {item.imageUrl && (
                  <img src={item.imageUrl} alt="" className="w-full md:w-28 aspect-video rounded-xl object-cover flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <Badge>{item.deliveryMode || 'bell'}</Badge>
                    <Badge>{item.audience || 'all'}</Badge>
                    <Badge>{item.screen || 'Home'}</Badge>
                  </div>
                  <p className="font-black truncate" style={{ color: 'var(--color-text)' }}>{item.title}</p>
                  <p className="text-sm line-clamp-2 mt-1" style={{ color: 'var(--color-text-muted)' }}>{item.body}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString() : 'No date'}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn-ghost px-4 py-2 text-sm flex items-center justify-center gap-2"
                  onClick={() => onDeleteNotification?.(item._id)}
                >
                  <RiDeleteBinLine /> Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function MessageUserModal({ user, form, setForm, onClose, onSend }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="card w-full max-w-xl">
        <div className="p-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              Message User
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {user.profileName || user.username || 'User'} · {user.email || 'No email'}
            </p>
          </div>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-4">
          {!user.email && (
            <div className="rounded-xl p-3 text-sm" style={{ background: 'rgba(239,68,68,0.12)', color: '#EF4444' }}>
              This user does not have an email address, so a message cannot be sent.
            </div>
          )}

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Subject</label>
            <input
              className="input-base"
              maxLength={150}
              value={form.subject}
              onChange={(event) => setForm({ ...form, subject: event.target.value })}
              placeholder="Message subject"
            />
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Message</label>
            <textarea
              className="input-base min-h-44 resize-y"
              maxLength={5000}
              value={form.message}
              onChange={(event) => setForm({ ...form, message: event.target.value })}
              placeholder="Write the email message..."
            />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
            <button onClick={onSend} disabled={!user.email} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
              <RiMailLine /> Send Email
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function UserDetailsModal({ details, onClose }) {
  const { user, stats } = details
  const fields = Object.entries(user || {}).filter(([key]) => !['_id', '__v'].includes(key))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.72)' }}>
      <div className="card w-full max-w-5xl max-h-[88vh] overflow-y-auto">
        <div className="p-5 flex items-start justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              {user.profileName || user.username || user.email || 'User'} Details
            </h2>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{user.email || user.username || user._id}</p>
          </div>
          <button onClick={onClose} className="btn-ghost px-4 py-2 text-sm">Close</button>
        </div>

        <div className="p-5 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(stats || {}).map(([key, value]) => (
              <div key={key} className="rounded-2xl p-4" style={{ background: 'var(--color-surface-high)' }}>
                <p className="text-xs font-black uppercase" style={{ color: 'var(--color-text-muted)' }}>{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="text-2xl font-black mt-1" style={{ color: 'var(--color-text)' }}>{value}</p>
              </div>
            ))}
          </div>

          <div>
            <h3 className="font-black mb-3" style={{ color: 'var(--color-text)' }}>Profile Record</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {fields.map(([key, value]) => (
                <div key={key} className="rounded-xl p-3" style={{ background: 'var(--color-surface-high)' }}>
                  <p className="text-xs font-black uppercase" style={{ color: 'var(--color-text-muted)' }}>{key}</p>
                  <p className="text-sm break-words" style={{ color: 'var(--color-text)' }}>
                    {formatDetailValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <RelatedList title="Recent Media" items={details.recentMedia} primaryKey="title" />
          <RelatedList title="Recent Documents" items={details.recentDocuments} primaryKey="title" />
          <RelatedList title="Recent Subscriptions" items={details.recentSubscriptions} primaryKey="plan" />
          <RelatedList title="Recent Downloads" items={details.recentDownloads} primaryKey="contentType" />
          <RelatedList title="Recent Rewards" items={details.recentRewards} primaryKey="type" />
        </div>
      </div>
    </div>
  )
}

function RelatedList({ title, items = [], primaryKey }) {
  return (
    <div>
      <h3 className="font-black mb-3" style={{ color: 'var(--color-text)' }}>{title}</h3>
      {items.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>No records.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {items.map((item) => (
            <div key={item._id} className="rounded-xl p-3" style={{ background: 'var(--color-surface-high)' }}>
              <p className="font-bold" style={{ color: 'var(--color-text)' }}>{item[primaryKey] || item._id}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>{formatDetailValue(item)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function formatDetailValue(value) {
  if (value === null || value === undefined || value === '') return '-'
  if (value instanceof Date) return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function useDebouncedValue(value, delay) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

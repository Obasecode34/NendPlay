import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { adminService, newsService } from '../services/index'

const tabs = [
  { id: 'overview', label: 'Overview', icon: RiDashboardLine },
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
  'Chinese Cinema', 'Hong Kong Cinema', 'Japanese Cinema', 'European Cinema',
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

function TableShell({ title, children, search, setSearch, filters }) {
  return (
    <div className="card overflow-hidden">
      <div className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between" style={{ borderBottom: '1px solid var(--color-border)' }}>
        <h2 className="font-display font-black text-xl" style={{ color: 'var(--color-text)' }}>{title}</h2>
        <div className="flex flex-wrap gap-2">
          <input
            className="input-base py-2 min-w-64"
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
    <table className="w-full text-left text-sm">
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
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [pushStats, setPushStats] = useState(null)
  const [pushForm, setPushForm] = useState({
    audience: 'all',
    userId: '',
    title: '',
    body: '',
    screen: 'Home',
  })
  const [notificationMode, setNotificationMode] = useState('push')
  const [inAppForm, setInAppForm] = useState({
    audience: 'all',
    userId: '',
    title: '',
    body: '',
    screen: 'Home',
  })
  const [pushImageFile, setPushImageFile] = useState(null)
  const [inAppImageFile, setInAppImageFile] = useState(null)
  const [pushSending, setPushSending] = useState(false)
  const [inAppSending, setInAppSending] = useState(false)
  const [bunnySyncing, setBunnySyncing] = useState(false)
  const [newsRows, setNewsRows] = useState([])
  const [newsMeta, setNewsMeta] = useState(null)
  const [newsFilters, setNewsFilters] = useState({
    tab: 'for-you',
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
    else if (activeTab === 'notifications') loadPushStats()
    else if (activeTab === 'news') loadNews(1)
    else loadTable(1)
  }, [activeTab, isAdmin, status, debouncedSearch, newsFilters.tab])

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
      const res = await adminService.getPushStats()
      setPushStats(res.data.data.stats)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load notification stats')
    } finally {
      setLoading(false)
    }
  }

  const loadNews = async (nextPage = page) => {
    setLoading(true)
    try {
      const res = await newsService.getDailyNews({
        page: nextPage,
        limit: 12,
        search: debouncedSearch || undefined,
        tab: newsFilters.tab,
        country: newsFilters.country || undefined,
        city: newsFilters.city || undefined,
        region: newsFilters.region || undefined,
      })
      const payload = res.data?.data?.data || res.data?.data || {}
      setNewsRows(payload.articles || [])
      setNewsMeta(payload)
      setPagination(payload.pagination || null)
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
      setPushForm({ audience: 'all', userId: '', title: '', body: '', screen: 'Home' })
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
    if (inAppForm.audience === 'user' && !inAppForm.userId.trim()) {
      toast.error('Enter a user ID for a single-user notification')
      return
    }

    setInAppSending(true)
    try {
      const payload = {
        audience: inAppForm.audience === 'user' ? undefined : inAppForm.audience,
        userId: inAppForm.audience === 'user' ? inAppForm.userId.trim() : undefined,
        title: inAppForm.title.trim(),
        body: inAppForm.body.trim(),
        screen: inAppForm.screen,
      }
      let requestBody = payload
      if (inAppImageFile) {
        requestBody = new FormData()
        Object.entries(payload).forEach(([key, value]) => {
          if (value === undefined || value === null) return
          requestBody.append(key, String(value))
        })
        requestBody.append('image', inAppImageFile)
      }
      await adminService.sendInAppNotification(requestBody)
      toast.success('Notification added to users bell inbox')
      setInAppForm({ audience: 'all', userId: '', title: '', body: '', screen: 'Home' })
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
      { key: 'isActive', label: 'Status', render: (row) => <Badge>{row.isActive ? 'active' : 'inactive'}</Badge> },
      { key: 'downloadCount', label: 'Downloads' },
      { key: 'createdAt', label: 'Created', render: (row) => new Date(row.createdAt).toLocaleDateString() },
    ]
    if (activeTab === 'ads') return [
      { key: 'title', label: 'Ad', render: (row) => <div><p className="font-bold max-w-sm truncate">{row.title}</p><p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{row.adType} · {row.placement}</p></div> },
      { key: 'advertiserName', label: 'Advertiser' },
      { key: 'status', label: 'Status', render: (row) => <Badge>{row.status}</Badge> },
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
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => openMediaEditModal(row)}>Edit</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media approved', () => adminService.approveMedia(row._id))}>Approve</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media rejected', () => adminService.rejectMedia(row._id, { reviewNote: 'Rejected by admin review' }))}>Reject</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Media archived', () => adminService.updateMedia(row._id, { publishStatus: 'archived', isActive: false }))}>Archive</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Feature updated', () => adminService.updateMedia(row._id, { isFeatured: !row.isFeatured }))}>{row.isFeatured ? 'Unfeature' : 'Feature'}</button>
          {isSuperAdmin && (
            <button className="btn-ghost px-3 py-1 text-xs flex items-center gap-1"
              style={{ color: '#EF4444' }}
              onClick={() => confirmDelete(`Permanently delete media "${row.title}"? This cannot be undone.`, () => adminService.deleteMedia(row._id))}>
              <RiDeleteBinLine /> Delete
            </button>
          )}
        </div>
      )
    }
    if (activeTab === 'documents') {
      return (
        <div className="flex flex-wrap gap-2">
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
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad approved', () => adminService.updateAd(row._id, { status: 'active', durationDays: row.durationDays || 1 }))}>Approve</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad paused', () => adminService.updateAd(row._id, { status: 'paused' }))}>Pause</button>
          <button className="btn-ghost px-3 py-1 text-xs" onClick={() => patchAndReload('Ad rejected', () => adminService.updateAd(row._id, { status: 'rejected', rejectionReason: 'Rejected by admin review' }))}>Reject</button>
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
          <h1 className="font-display font-black text-3xl gradient-text">Admin Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Full NendPlay operations control center</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => { setActiveTab(id); setSearch(''); setStatus(''); setPage(1) }}
            className="px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"
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

      {!loading && activeTab !== 'overview' && (
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
  const [postForm, setPostForm] = useState({
    header: '',
    subHeader: '',
    body: '',
    categories: ['headlines'],
    adsEnabled: true,
    status: 'published',
  })
  const [postFiles, setPostFiles] = useState([])
  const [posting, setPosting] = useState(false)
  const categoryOptions = NEWS_TAB_OPTIONS
    .filter((option) => !['for-you'].includes(option.value))
    .map((option) => ({ ...option, value: option.value.toLowerCase() }))

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

  const submitPost = async () => {
    if (!postForm.header.trim() || !postForm.body.trim()) {
      toast.error('Header and body text are required')
      return
    }
    if (!postForm.categories.length) {
      toast.error('Choose at least one category')
      return
    }

    const data = new FormData()
    data.append('header', postForm.header)
    data.append('subHeader', postForm.subHeader)
    data.append('body', postForm.body)
    data.append('categories', postForm.categories.join(','))
    data.append('adsEnabled', String(postForm.adsEnabled))
    data.append('status', postForm.status)
    postFiles.forEach((file) => data.append('media', file))

    setPosting(true)
    try {
      await adminService.createNewsPost(data)
      toast.success('News posted')
      setPostForm({ header: '', subHeader: '', body: '', categories: ['headlines'], adsEnabled: true, status: 'published' })
      setPostFiles([])
      onRefresh()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not post news')
    } finally {
      setPosting(false)
    }
  }

  return (
    <div className="space-y-5">
      <div className="card p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              Post NendPlay News
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Publish admin-created news with videos first, pictures second, body text, comments, sharing, and in-article ad placement.
            </p>
          </div>
          <Badge>{postForm.categories.length}/5 categories</Badge>
        </div>

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
          <p className="text-sm font-black mb-2" style={{ color: 'var(--color-text)' }}>Categories</p>
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
            accept="image/*,video/*"
            className="input-base"
            onChange={(event) => setPostFiles(Array.from(event.target.files || []))}
          />
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--color-text)' }}>
            <input
              type="checkbox"
              checked={postForm.adsEnabled}
              onChange={(event) => setPostForm({ ...postForm, adsEnabled: event.target.checked })}
            />
            Ads between text
          </label>
          <button className="btn-primary px-5 py-3 text-sm" disabled={posting} onClick={submitPost}>
            {posting ? 'Posting...' : 'Post News'}
          </button>
        </div>

        {postFiles.length > 0 && (
          <p className="text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
            {postFiles.length} file(s) selected. Videos will be displayed before pictures.
          </p>
        )}
      </div>

      <div className="card p-5">
        <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
          <div>
            <h2 className="font-display font-black text-2xl" style={{ color: 'var(--color-text)' }}>
              Daily News Control
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
              Preview the live news feed users see in Daily News. The feed uses NewsAPI when configured and NendPlay fallback stories when a provider is unavailable.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{meta?.source || 'news'}</Badge>
            {updatedAt && <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Updated {updatedAt}</span>}
          </div>
        </div>

        <div className="mt-5 flex gap-2 overflow-x-auto pb-2">
          {NEWS_TAB_OPTIONS.map((option) => (
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
          <input
            className="input-base"
            placeholder="Country"
            value={filters.country}
            onChange={(event) => setFilters({ ...filters, country: event.target.value })}
          />
          <input
            className="input-base"
            placeholder="City"
            value={filters.city}
            onChange={(event) => setFilters({ ...filters, city: event.target.value })}
          />
          <input
            className="input-base"
            placeholder="Region/state"
            value={filters.region}
            onChange={(event) => setFilters({ ...filters, region: event.target.value })}
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
                    <Badge>{article.category || filters.tab}</Badge>
                    <Badge>{article.region || meta?.location?.country || 'Global'}</Badge>
                  </div>
                  {article.url ? (
                    <a className="btn-ghost px-4 py-2 text-sm" href={article.url} target="_blank" rel="noreferrer">
                      Open Story
                    </a>
                  ) : (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      {article.kind === 'nendplay' ? 'NendPlay post' : 'Fallback preview'}
                    </span>
                  )}
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
}) {
  const activeForm = mode === 'push' ? form : inAppForm
  const setActiveForm = mode === 'push' ? setForm : setInAppForm
  const activeImageFile = mode === 'push' ? imageFile : inAppImageFile
  const setActiveImageFile = mode === 'push' ? setImageFile : setInAppImageFile
  const activeSending = mode === 'push' ? sending : inAppSending
  const activeSend = mode === 'push' ? onSend : onSendInApp
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
        <StatCard label="Bell Notices" value={stats?.inApp?.active || 0} icon={RiNotification3Line} />
      </div>

      <div className="card p-5">
        <div className="mb-5 flex flex-wrap gap-2">
          {[
            { id: 'push', label: 'Push Notifications' },
            { id: 'in-app', label: 'Notifications' },
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
            {mode === 'push' ? 'Send Push Notification' : 'Send Bell Notification'}
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            {mode === 'push'
              ? 'Send updates to everyone who allowed mobile notifications, including guests, users, admins, and super-admins.'
              : 'Send an in-app notification that appears when users tap the bell icon in NendPlay.'}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Audience</label>
            <select
              className="input-base"
              value={activeForm.audience}
              onChange={(event) => setActiveForm({ ...activeForm, audience: event.target.value })}
            >
              <option value="all">{mode === 'push' ? 'Guests + users + admins' : 'All registered users + admins'}</option>
              {mode === 'in-app' && <option value="admins">Admins only</option>}
              <option value="subscribers">Subscribed users</option>
              <option value="free_users">Free users</option>
              <option value="user">One user ID</option>
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

          {activeForm.audience === 'user' && (
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
              maxLength={mode === 'push' ? 80 : 120}
              value={activeForm.title}
              onChange={(event) => setActiveForm({ ...activeForm, title: event.target.value })}
              placeholder="New release on NendPlay"
            />
          </div>

          <div className="lg:col-span-2">
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--color-text-muted)' }}>Message</label>
            <textarea
              className="input-base min-h-32 resize-y"
              maxLength={mode === 'push' ? 180 : 800}
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
            <RiNotification3Line /> {activeSending ? 'Sending...' : mode === 'push' ? 'Send Push' : 'Send Notification'}
          </button>
        </div>
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

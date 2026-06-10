import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiDownloadLine, RiDeleteBinLine, RiPlayFill, RiDeviceLine,
  RiWifiOffLine, RiBookOpenLine } from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import { downloadService } from '../services/index'
import { deleteLocalDownload, getCachedObjectUrl, getLocalDownloads } from '../services/localDownloads'
import useAuthStore from '../stores/authStore'

const DOWNLOAD_PAGE_LIMIT = 30

const CATEGORY_LABELS = {
  movies: '🎬 Movies', music: '🎵 Music', tvShows: '📺 TV Shows',
  videos: '🎥 Videos', podcasts: '🎙 Podcasts', shorts: '⚡ Shorts',
  documents: '📄 Documents', other: '📁 Other',
}

const formatSize = (bytes) => {
  if (!bytes) return '—'
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DownloadsPage({ embedded = false, contentType = '' }) {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [downloads, setDownloads] = useState([])
  const [grouped, setGrouped] = useState({})
  const [devices, setDevices] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [deviceInfo, setDeviceInfo] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ rootMargin: '320px' })

  const deviceId = localStorage.getItem('nendplay-device-id') || 'unknown'

  useEffect(() => {
    fetchDownloads(1, false)
    if (isAuthenticated) fetchDevices()
  }, [isAuthenticated, contentType])

  useEffect(() => {
    if (!isAuthenticated || !loadMoreInView || loading || loadingMore || !hasMore) return
    fetchDownloads(page + 1, true)
  }, [loadMoreInView, loading, loadingMore, hasMore, page])

  const fetchDownloads = async (pageToLoad = 1, append = false) => {
    const localItems = await getLocalDownloads({ contentType })
    if (!isAuthenticated) {
      setDownloads(localItems)
      setGrouped(groupDownloads(localItems))
      setPage(1)
      setHasMore(false)
      setLoading(false)
      setLoadingMore(false)
      return
    }
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await downloadService.getAll({
        deviceId,
        page: pageToLoad,
        limit: DOWNLOAD_PAGE_LIMIT,
        ...(contentType ? { contentType } : {}),
      })
      const nextDownloads = res.data.data.downloads || []
      const pagination = res.data.data.pagination || {}
      const merged = mergeDownloads(append ? [...downloads, ...nextDownloads] : nextDownloads, localItems)
      setDownloads(merged)
      setGrouped(groupDownloads(merged))
      setPage(pageToLoad)
      setHasMore(pageToLoad < (pagination.pages || 1))
    } catch {
      setDownloads(localItems)
      setGrouped(groupDownloads(localItems))
      setHasMore(false)
      toast.error('Showing offline downloads only')
    }
    finally { setLoading(false); setLoadingMore(false) }
  }

  const fetchDevices = async () => {
    if (!isAuthenticated) return
    try {
      const res = await downloadService.getDevices()
      setDevices(res.data.data.devices)
      setDeviceInfo(res.data.data)
    } catch {}
  }

  const handleDelete = async (id, storageKey) => {
    try {
      const item = downloads.find((download) => download._id === id)
      if (item?.localOnly) {
        await deleteLocalDownload(item.storageKey)
      } else {
        await downloadService.delete(id)
        await deleteLocalDownload(storageKey)
      }
      toast.success('Download removed')
      fetchDownloads(1, false)
      fetchDevices()
    } catch { toast.error('Failed to remove download') }
  }

  const handleClearDevice = async (devId) => {
    try {
      await downloadService.deleteDevice(devId)
      toast.success('All downloads cleared from this device')
      fetchDownloads(1, false)
      fetchDevices()
    } catch { toast.error('Failed to clear device') }
  }

  const getDisplayItems = () => {
    if (activeTab === 'all') return downloads
    return grouped[activeTab] || []
  }

  const groupDownloads = (items = []) => {
    const groupedItems = {
      movies: [], music: [], tvShows: [], videos: [], podcasts: [], shorts: [], documents: [], other: [],
    }
    items.forEach((d) => {
      const type = d.contentSnapshot?.type || ''
      if (type === 'movie') groupedItems.movies.push(d)
      else if (type === 'music') groupedItems.music.push(d)
      else if (type === 'tv_show') groupedItems.tvShows.push(d)
      else if (type === 'video') groupedItems.videos.push(d)
      else if (type === 'podcast') groupedItems.podcasts.push(d)
      else if (type === 'short') groupedItems.shorts.push(d)
      else if (d.contentType === 'document') groupedItems.documents.push(d)
      else groupedItems.other.push(d)
    })
    return groupedItems
  }

  const mergeDownloads = (serverItems = [], localItems = []) => {
    const seen = new Set()
    return [...localItems, ...serverItems].filter((item) => {
      const key = `${item.contentType}:${item.contentId || item._id}:${item.storageKey || ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).sort((a, b) => new Date(b.downloadedAt || 0) - new Date(a.downloadedAt || 0))
  }

  const handleOpenDownload = async (download) => {
    const cachedUrl = await getCachedObjectUrl(download.storageKey)
    if (cachedUrl) {
      window.open(cachedUrl, '_blank')
      return
    }
    if (download.contentType === 'media') navigate(`/watch/${download.contentId}`)
    else window.open(download.contentSnapshot?.fileUrl, '_blank')
  }

  const nonEmptyCategories = Object.entries(grouped)
    .filter(([, items]) => items.length > 0)
    .map(([key]) => key)

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 skeleton rounded" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="skeleton rounded-xl h-32" />)}
        </div>
      </div>
    )
  }

  if (!isAuthenticated && downloads.length === 0) {
    return (
      <div className="animate-fade-in max-w-3xl">
        <div className="card p-8 text-center">
          <RiDownloadLine className="text-5xl mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
          <h1 className="font-display font-bold text-3xl mb-3 gradient-text">No downloads yet</h1>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            You can browse, watch, read, and download files without an account. Downloaded files saved in this browser will appear here for offline access.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <button onClick={() => navigate(contentType === 'document' ? '/novelhub' : '/home')} className="btn-primary px-5 py-3">
              Browse Content
            </button>
            <button onClick={() => navigate('/register')}
              className="px-5 py-3 rounded-xl font-bold"
              style={{ background: 'var(--color-surface-high)', color: 'var(--color-text)' }}>
              Create Account to Sync History
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? '' : 'animate-fade-in'}>
      {/* Header */}
      {!embedded && <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display font-bold text-3xl gradient-text">Downloads</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Available offline
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
          style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <RiWifiOffLine style={{ color: 'var(--color-primary)' }} />
          <span style={{ color: 'var(--color-text-muted)' }}>
            {downloads.length} files saved
          </span>
        </div>
      </div>}

      {/* Device slots */}
      {!embedded && deviceInfo && (
        <div className="card p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              Download Devices
            </h2>
            <span className="text-xs px-2 py-1 rounded-lg"
              style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
              {deviceInfo.slotsUsed}/{deviceInfo.slotsTotal} slots used
            </span>
          </div>

          {/* Slots bar */}
          <div className="flex gap-2 mb-4">
            {[...Array(deviceInfo.slotsTotal)].map((_, i) => (
              <div key={i} className="flex-1 h-2 rounded-full"
                style={{
                  background: i < deviceInfo.slotsUsed
                    ? 'var(--color-primary)'
                    : 'var(--color-surface-high)'
                }} />
            ))}
          </div>

          {devices.length > 0 ? (
            <div className="space-y-2">
              {devices.map((device) => (
                <div key={device.deviceId}
                  className="flex items-center justify-between p-3 rounded-xl"
                  style={{ background: 'var(--color-surface-high)' }}>
                  <div className="flex items-center gap-3">
                    <RiDeviceLine style={{ color: 'var(--color-primary)' }} />
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                        {device.deviceId === deviceId ? 'This device' : device.deviceInfo}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        {device.downloadCount} files · {device.totalSizeMB} MB
                      </p>
                    </div>
                  </div>
                  {device.deviceId !== deviceId && (
                    <button onClick={() => handleClearDevice(device.deviceId)}
                      className="text-xs px-3 py-1 rounded-lg transition-colors"
                      style={{ color: '#EF4444', background: 'rgba(239,68,68,0.1)' }}>
                      Remove
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-center py-2" style={{ color: 'var(--color-text-muted)' }}>
              No downloads on any device yet
            </p>
          )}
        </div>
      )}

      {downloads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
            <RiDownloadLine className="text-2xl" />
          </div>
          <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--color-text)' }}>
            No downloads yet
          </p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
            {contentType === 'document'
              ? 'Download PDFs from NovelHub to read them offline'
              : 'Download media to watch offline'}
          </p>
          <button onClick={() => navigate(contentType === 'document' ? '/novelhub' : '/home')} className="btn-primary">
            Browse Content
          </button>
        </div>
      ) : (
        <>
          {/* Category tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto no-scrollbar pb-1">
            <button onClick={() => setActiveTab('all')}
              className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all"
              style={{
                background: activeTab === 'all' ? 'var(--color-primary)' : 'var(--color-surface)',
                color: activeTab === 'all' ? 'white' : 'var(--color-text-muted)',
              }}>
              All ({downloads.length})
            </button>
            {nonEmptyCategories.map((key) => (
              <button key={key} onClick={() => setActiveTab(key)}
                className="px-4 py-2 rounded-xl text-sm font-medium flex-shrink-0 transition-all"
                style={{
                  background: activeTab === key ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: activeTab === key ? 'white' : 'var(--color-text-muted)',
                }}>
                {CATEGORY_LABELS[key]} ({grouped[key]?.length})
              </button>
            ))}
          </div>

          {/* Downloads grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getDisplayItems().map((dl) => {
              const snap = dl.contentSnapshot
              const isMedia = dl.contentType === 'media'
              return (
                <div key={dl._id} className="card p-4 flex gap-3">
                  {/* Thumbnail */}
                  <div className="w-20 h-14 rounded-lg overflow-hidden flex-shrink-0"
                    style={{ background: 'var(--color-surface-high)' }}>
                    {snap.thumbnailUrl ? (
                      <img src={snap.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        {isMedia
                          ? <RiPlayFill style={{ color: 'var(--color-primary)' }} />
                          : <RiBookOpenLine style={{ color: 'var(--color-primary)' }} />
                        }
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text)' }}>
                      {snap.title}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
                      {snap.type?.replace('_', ' ')} · {formatSize(snap.fileSize)}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => handleOpenDownload(dl)}
                        className="text-xs px-3 py-1 rounded-lg font-medium transition-all"
                        style={{ background: 'var(--color-primary)', color: 'white' }}>
                        {isMedia ? 'Play' : 'Open'}
                      </button>
                      <button onClick={() => handleDelete(dl._id, dl.storageKey)}
                        className="w-6 h-6 rounded-lg flex items-center justify-center transition-colors"
                        style={{ color: '#EF4444' }}>
                        <RiDeleteBinLine className="text-xs" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <div ref={loadMoreRef} className="flex items-center justify-center py-8">
            {loadingMore && (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            )}
          </div>
        </>
      )}
    </div>
  )
}

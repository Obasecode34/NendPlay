import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactPlayer from 'react-player'
import {
  RiPlayFill, RiPauseFill, RiVolumeMuteFill, RiVolumeUpFill,
  RiFullscreenFill, RiHeartLine, RiHeartFill, RiDownloadLine,
  RiArrowLeftLine, RiLockFill, RiShareLine
} from 'react-icons/ri'
import toast from 'react-hot-toast'
import { mediaService, downloadService } from '../services/index'
import { cacheDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloads'
import useAuthStore from '../stores/authStore'
import usePlayerStore from '../stores/playerStore'
import MediaCard from '../components/media/MediaCard'

function getCollectionLabel(item) {
  if (item.collectionType === 'series_episode') {
    const season = item.seasonNumber !== null && item.seasonNumber !== undefined ? `S${item.seasonNumber}` : 'Season'
    const episode = item.episodeNumber !== null && item.episodeNumber !== undefined ? `E${item.episodeNumber}` : 'Episode'
    return `${season}:${episode}${item.episodeTitle ? ` · ${item.episodeTitle}` : ''}`
  }
  if (item.collectionType === 'movie_part') {
    return `Part ${item.partNumber || ''}`.trim()
  }
  return item.title
}

export default function MediaPlayerPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const { setMedia, setProgress, setDuration } = usePlayerStore()

  const playerRef = useRef(null)
  const [media, setMediaData] = useState(null)
  const [related, setRelated] = useState([])
  const [collectionItems, setCollectionItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [locked, setLocked] = useState(false)
  const [playbackUrl, setPlaybackUrl] = useState('')
  const [playing, setPlaying] = useState(true)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [played, setPlayed] = useState(0)
  const [duration, setLocalDuration] = useState(0)
  const [liked, setLiked] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const controlsTimer = useRef(null)

  useEffect(() => {
    fetchMedia()
    return () => clearTimeout(controlsTimer.current)
  }, [id])

  const fetchMedia = async () => {
    setLoading(true)
    try {
      const res = await mediaService.getById(id)
      const { media: m, locked: isLocked } = res.data.data
      setMediaData(m)
      setLocked(isLocked)
      setPlaybackUrl('')
      setCollectionItems([m, ...(m.collectionItems || [])].sort((a, b) => (
        (a.seasonNumber || 0) - (b.seasonNumber || 0)
        || (a.episodeNumber || 0) - (b.episodeNumber || 0)
        || (a.partNumber || 0) - (b.partNumber || 0)
        || new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
      )))

      // Load related content
      const relRes = await mediaService.getAll({ type: m.type, limit: 10 })
      setRelated(relRes.data.data.media.filter(r => r._id !== id))

      if (!isLocked) {
        setMedia(m)
        const playbackRes = await mediaService.getPlayback(id)
        const playback = playbackRes.data.data.playback
        setPlaybackUrl(mediaService.resolveStreamUrl(playback.streamUrl))
      }
    } catch (err) {
      toast.error('Media not found')
      navigate('/home')
    } finally {
      setLoading(false)
    }
  }

  const handleMouseMove = () => {
    setShowControls(true)
    clearTimeout(controlsTimer.current)
    controlsTimer.current = setTimeout(() => setShowControls(false), 3000)
  }

  const handleLike = async () => {
    try {
      await mediaService.like(id)
      setLiked(true)
      toast.success('Liked!')
    } catch {
      toast.error('Failed to like')
    }
  }

  const handleDownload = async () => {
    try {
      const deviceId = localStorage.getItem('nendplay-device-id') ||
        (() => { const id = 'device-' + Date.now(); localStorage.setItem('nendplay-device-id', id); return id })()

      const res = await downloadService.authorize({
        contentType: 'media',
        contentId: id,
        deviceId,
        platform: 'web',
      })

      if (res.data.data.alreadyDownloaded) {
        toast.success('Already in your downloads!')
        return
      }

      const fileUrl = playbackUrl || mediaService.resolveStreamUrl(mediaService.getStreamUrl(id)) || res.data.data.fileUrl
      const cachedFile = await cacheDownloadFile({
        fileUrl,
        contentType: 'media',
        contentId: id,
      })
      upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'media',
        contentId: id,
        storageKey: cachedFile.storageKey,
        storedFileSize: cachedFile.storedFileSize || media?.fileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: media?.title || res.data.data.title || 'media',
          thumbnailUrl: media?.thumbnailUrl || '',
          type: media?.type || 'video',
          category: media?.category || '',
          duration: media?.duration || 0,
          mimeType: media?.mimeType || res.data.data.mimeType || '',
          fileUrl,
        },
      })

      if (isAuthenticated && res.data.data.download?._id) {
        await downloadService.complete({
          downloadId: res.data.data.download._id,
          storageKey: cachedFile.storageKey,
          storedFileSize: cachedFile.storedFileSize || media?.fileSize || 0,
        })
        toast.success('Added to downloads!')
      } else {
        toast.success('Saved to Downloads for offline playback.')
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed')
    }
  }

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/watch/${id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: media?.title || 'NendPlay media',
          text: `Watch ${media?.title || 'this media'} on NendPlay`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(`${media?.title || 'NendPlay media'} - ${shareUrl}`)
        toast.success('Share link copied to clipboard')
      }
    } catch {
      toast.error('Unable to share this media')
    }
  }

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = Math.floor(seconds % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  if (loading) {
    return (
      <div className="animate-fade-in">
        <div className="skeleton rounded-2xl mb-4" style={{ aspectRatio: '16/9', maxHeight: '500px' }} />
        <div className="h-6 w-64 skeleton rounded mb-2" />
        <div className="h-4 w-48 skeleton rounded" />
      </div>
    )
  }

  if (!media) return null

  const streamUrl = playbackUrl || mediaService.getStreamUrl(id)

  return (
    <div className="animate-fade-in">
      <div className="flex gap-6">
        {/* Main player */}
        <div className="flex-1 min-w-0">
          {/* Back button */}
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-2 mb-4 text-sm transition-colors"
            style={{ color: 'var(--color-text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--color-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--color-text-muted)'}>
            <RiArrowLeftLine /> Back
          </button>

          {/* Player */}
          {locked ? (
            <div className="relative rounded-2xl overflow-hidden flex items-center justify-center"
              style={{ aspectRatio: '16/9', background: 'var(--color-surface)', maxHeight: '500px' }}>
              {media.thumbnailUrl && (
                <img src={media.thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
              )}
              <div className="relative z-10 text-center p-8">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>
                  <RiLockFill className="text-2xl text-yellow-400" />
                </div>
                <h3 className="font-display font-bold text-xl text-white mb-2">
                  Premium Content
                </h3>
                <p className="text-white/60 text-sm mb-4">
                  Subscribe to access this content
                </p>
                <button onClick={() => navigate('/subscribe')} className="btn-primary">
                  Subscribe Now
                </button>
              </div>
            </div>
          ) : (
            <div
              className="relative rounded-2xl overflow-hidden cursor-pointer"
              style={{ background: '#000', maxHeight: '500px' }}
              onMouseMove={handleMouseMove}
              onClick={() => setPlaying(!playing)}>

              <ReactPlayer
                ref={playerRef}
                url={streamUrl}
                playing={playing}
                volume={muted ? 0 : volume}
                width="100%"
                height="100%"
                style={{ aspectRatio: '16/9' }}
                onProgress={({ playedSeconds, played }) => {
                  setPlayed(played)
                  setProgress(playedSeconds)
                }}
                onDuration={(d) => { setLocalDuration(d); setDuration(d) }}
                onError={(error) => {
                  console.error('Media playback error', error)
                  toast.error('Playback failed. Please try again in a moment.')
                }}
                config={{ file: { attributes: { controlsList: 'nodownload' } } }}
              />

              {/* Custom controls */}
              <div
                className={`absolute inset-0 flex flex-col justify-end transition-opacity duration-300
                  ${showControls ? 'opacity-100' : 'opacity-0'}`}
                style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 60%)' }}
                onClick={(e) => e.stopPropagation()}>

                {/* Progress bar */}
                <div className="px-4 pb-2">
                  <input
                    type="range" min={0} max={1} step={0.001}
                    value={played}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setPlayed(val)
                      playerRef.current?.seekTo(val)
                    }}
                    className="w-full h-1 rounded-full cursor-pointer accent-primary"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                </div>

                <div className="flex items-center justify-between px-4 pb-4">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPlaying(!playing)}
                      className="text-white text-2xl">
                      {playing ? <RiPauseFill /> : <RiPlayFill />}
                    </button>
                    <button onClick={() => setMuted(!muted)} className="text-white text-xl">
                      {muted ? <RiVolumeMuteFill /> : <RiVolumeUpFill />}
                    </button>
                    <input
                      type="range" min={0} max={1} step={0.05}
                      value={volume}
                      onChange={(e) => setVolume(parseFloat(e.target.value))}
                      className="w-20 cursor-pointer"
                      style={{ accentColor: 'var(--color-primary)' }}
                    />
                    <span className="text-white text-xs font-mono">
                      {formatTime(played * duration)} / {formatTime(duration)}
                    </span>
                  </div>
                  <button onClick={() => playerRef.current?.getInternalPlayer()?.requestFullscreen()}
                    className="text-white text-xl">
                    <RiFullscreenFill />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Media info */}
          <div className="mt-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="font-display font-bold text-2xl mb-1" style={{ color: 'var(--color-text)' }}>
                  {media.title}
                </h1>
                <div className="flex items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  <span className="capitalize">{media.type?.replace('_', ' ')}</span>
                  {media.releaseYear && <span>• {media.releaseYear}</span>}
                  {media.artist && <span>• {media.artist}</span>}
                  <span>• {media.viewCount || 0} views</span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleLike}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: liked ? 'var(--color-primary)' : 'var(--color-surface)',
                    color: liked ? 'white' : 'var(--color-text-muted)',
                    border: '1px solid var(--color-border)',
                  }}>
                  {liked ? <RiHeartFill /> : <RiHeartLine />}
                  {media.likeCount + (liked ? 1 : 0)}
                </button>

                <button onClick={handleDownload}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                  <RiDownloadLine /> Download
                </button>

                <button
                  onClick={handleShare}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)', border: '1px solid var(--color-border)' }}>
                  <RiShareLine />
                </button>
              </div>
            </div>

            {media.description && (
              <p className="mt-4 text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
                {media.description}
              </p>
            )}

            {collectionItems.length > 1 && (
              <div className="mt-6">
                <h2 className="font-display font-bold text-lg mb-3" style={{ color: 'var(--color-text)' }}>
                  {media.parentTitle || 'Episodes & Parts'}
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {collectionItems.map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => item._id !== id && navigate(`/watch/${item._id}`)}
                      className="text-left rounded-xl p-3 flex gap-3 transition-colors"
                      style={{
                        background: item._id === id ? 'var(--color-primary)' : 'var(--color-surface)',
                        color: item._id === id ? '#fff' : 'var(--color-text)',
                        border: '1px solid var(--color-border)',
                      }}
                    >
                      <div className="w-24 aspect-video rounded-lg overflow-hidden flex-shrink-0" style={{ background: 'rgba(0,0,0,0.25)' }}>
                        {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="w-full h-full object-cover" /> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="font-black text-sm truncate">{getCollectionLabel(item)}</p>
                        <p className="text-xs opacity-70 truncate">{item.title}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Related */}
        {related.length > 0 && (
          <div className="w-72 flex-shrink-0 hidden xl:block">
            <h2 className="font-display font-bold text-lg mb-4" style={{ color: 'var(--color-text)' }}>
              Up Next
            </h2>
            <div className="space-y-3">
              {related.slice(0, 8).map((item) => (
                <MediaCard key={item._id} media={item} size="full" />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

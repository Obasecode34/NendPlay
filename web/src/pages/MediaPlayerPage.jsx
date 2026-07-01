import React, { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactPlayer from 'react-player'
import {
  RiPlayFill, RiPauseFill, RiVolumeMuteFill, RiVolumeUpFill,
  RiFullscreenFill, RiHeartLine, RiHeartFill, RiDownloadLine,
  RiArrowLeftLine, RiLockFill, RiShareLine, RiAddLine,
  RiSkipBackFill, RiSkipForwardFill
} from 'react-icons/ri'
import toast from 'react-hot-toast'
import { mediaService, downloadService } from '../services/index'
import { cacheDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloads'
import { getDeviceId } from '../services/guestSession'
import { upsertContinueWatching, removeContinueWatching } from '../services/continueWatching'
import { addWatchHistory } from '../services/watchHistory'
import useAuthStore from '../stores/authStore'
import usePlayerStore from '../stores/playerStore'
import MediaCard from '../components/media/MediaCard'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'

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
  const [activeInfoTab, setActiveInfoTab] = useState('overview')
  const [autoPlayNext, setAutoPlayNext] = useState(true)
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
      const deviceId = getDeviceId()

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

      if (res.data.data.download?._id) {
        try {
          await downloadService.complete({
            downloadId: res.data.data.download._id,
            storageKey: cachedFile.storageKey,
            storedFileSize: cachedFile.storedFileSize || media?.fileSize || 0,
          })
        } catch {}
      }
      toast.success('Saved to Downloads for offline playback.')
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
    const total = Math.max(0, Math.floor(seconds || 0))
    const h = Math.floor(total / 3600)
    const m = Math.floor((total % 3600) / 60)
    const s = total % 60
    if (h) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const seekRelative = (seconds) => {
    const next = Math.max(0, Math.min(duration || 0, played * duration + seconds))
    playerRef.current?.seekTo(next, 'seconds')
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
  const thumbnailUrl = mediaService.getThumbnailUrl?.(media) || media.thumbnailUrl || ''
  const genreText = Array.isArray(media.genres) && media.genres.length
    ? media.genres.slice(0, 3).join(', ')
    : media.genre || media.category || 'Entertainment'
  const castText = Array.isArray(media.cast) && media.cast.length
    ? media.cast.join(', ')
    : media.artist || 'NendPlay Creators'
  const nextUp = collectionItems.find((item) => item._id !== id) || collectionItems[0]
  const moreLikeThis = related.length ? related.slice(0, 8) : collectionItems.filter((item) => item._id !== id).slice(0, 8)

  return (
    <div className="animate-fade-in">
      <section className="overflow-hidden rounded-3xl border" style={{ background: '#02020a', borderColor: 'var(--color-border)' }}>
        <div className="flex items-center gap-4 px-5 py-4">
          <button onClick={() => navigate(-1)} className="text-2xl text-white"><RiArrowLeftLine /></button>
          <h1 className="min-w-0 flex-1 truncate text-base font-black text-white md:text-lg">{media.title}</h1>
          <button className="rounded-full px-3 py-2 text-sm font-black text-white/80 ring-1 ring-white/10">Cast</button>
          <button className="rounded-full px-3 py-2 text-sm font-black text-white/80 ring-1 ring-white/10">CC</button>
          <button className="rounded-full px-3 py-2 text-sm font-black text-white/80 ring-1 ring-white/10">More</button>
        </div>

        {locked ? (
          <div className="relative flex aspect-video max-h-[620px] items-center justify-center overflow-hidden">
            {thumbnailUrl && <img src={thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />}
            <div className="relative z-10 p-8 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-black/70">
                <RiLockFill className="text-3xl text-yellow-400" />
              </div>
              <h3 className="mb-2 text-xl font-black text-white">Premium Content</h3>
              <p className="mb-4 text-sm text-white/60">Subscribe to access this content</p>
              <button onClick={() => navigate('/subscribe')} className="btn-primary">Subscribe Now</button>
            </div>
          </div>
        ) : (
          <div className="relative aspect-video max-h-[620px] cursor-pointer bg-black" onMouseMove={handleMouseMove} onClick={() => setPlaying(!playing)}>
            <ReactPlayer
              ref={playerRef}
              url={streamUrl}
              playing={playing}
              volume={muted ? 0 : volume}
              width="100%"
              height="100%"
              onProgress={({ playedSeconds, played }) => {
                setPlayed(played)
                setProgress(playedSeconds)
                upsertContinueWatching(media, { played, playedSeconds, duration })
              }}
              onDuration={(d) => { setLocalDuration(d); setDuration(d) }}
              onEnded={() => {
                addWatchHistory(media, { duration })
                removeContinueWatching(id)
                if (autoPlayNext && nextUp?._id && nextUp._id !== id) navigate(`/watch/${nextUp._id}`)
              }}
              onError={(error) => {
                console.error('Media playback error', error)
                toast.error('Playback failed. Please try again in a moment.')
              }}
              config={{ file: { attributes: { controlsList: 'nodownload' } } }}
            />

            <div
              className={`absolute inset-0 flex flex-col justify-between bg-black/30 p-5 transition-opacity duration-300 ${showControls ? 'opacity-100' : 'opacity-0'}`}
              onClick={(e) => e.stopPropagation()}>
              <div className="flex items-start justify-between">
                <div className="flex w-14 flex-col items-center gap-2 rounded-3xl bg-black/55 py-3 text-white">
                  <span className="text-lg">☀</span>
                  <div className="h-28 w-1 overflow-hidden rounded bg-white/30">
                    <div className="mt-auto h-2/3 w-full rounded bg-purple-500" />
                  </div>
                  <span className="text-[10px]">Brightness</span>
                </div>
                <button className="rounded-full bg-black/55 p-4 text-white"><RiLockFill /></button>
                <div className="flex w-14 flex-col items-center gap-2 rounded-3xl bg-black/55 py-3 text-white">
                  {muted ? <RiVolumeMuteFill /> : <RiVolumeUpFill />}
                  <input type="range" min={0} max={1} step={0.05} value={volume} onChange={(e) => setVolume(parseFloat(e.target.value))} className="h-28 w-1 rotate-[-90deg] accent-purple-500" />
                  <span className="text-[10px]">Volume</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-8 text-white">
                <button className="text-4xl" onClick={() => seekRelative(-10)}><RiSkipBackFill /></button>
                <button className="rounded-full border-2 border-white p-6 text-5xl" onClick={() => setPlaying(!playing)}>
                  {playing ? <RiPauseFill /> : <RiPlayFill />}
                </button>
                <button className="text-4xl" onClick={() => seekRelative(10)}><RiSkipForwardFill /></button>
              </div>

              <div>
                <div className="mb-4 flex items-center gap-3 text-sm font-black text-white">
                  <span>{formatTime(played * duration)}</span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.001}
                    value={played}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value)
                      setPlayed(val)
                      playerRef.current?.seekTo(val)
                    }}
                    className="h-1 flex-1 cursor-pointer accent-purple-500"
                  />
                  <span>{formatTime(duration)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs font-black text-white/90 md:grid-cols-6">
                  {['Playlist', 'Subtitles', 'Audio', 'Speed', 'Quality', 'Fullscreen'].map((label) => (
                    <button
                      key={label}
                      className="rounded-xl bg-black/40 px-3 py-2"
                      onClick={() => label === 'Fullscreen' ? playerRef.current?.getInternalPlayer()?.requestFullscreen?.() : toast(`${label} settings`)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="mt-0 rounded-b-3xl border border-t-0 p-5 md:p-7" style={{ background: 'linear-gradient(135deg, rgba(13,13,32,0.98), rgba(3,3,12,0.98))', borderColor: 'var(--color-border)' }}>
        <div className="grid gap-6 lg:grid-cols-[1fr_230px]">
          <div>
            <h2 className="max-w-3xl text-2xl font-black text-white md:text-3xl">{media.title}</h2>
            <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {media.type?.replace('_', ' ') || 'video'} | {media.viewCount || 0} views
              {media.releaseYear ? ` | ${media.releaseYear}` : ''} | {genreText}
              {duration ? ` | ${formatTime(duration)}` : ''}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button onClick={handleLike} className="flex items-center gap-2 rounded-xl px-4 py-2 font-black" style={{ background: liked ? 'var(--color-primary)' : 'var(--color-surface)', color: liked ? '#fff' : 'var(--color-text)' }}>
                {liked ? <RiHeartFill /> : <RiHeartLine />} Like
              </button>
              <button onClick={handleDownload} className="flex items-center gap-2 rounded-xl px-4 py-2 font-black" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}><RiDownloadLine /> Download</button>
              <button onClick={handleShare} className="flex items-center gap-2 rounded-xl px-4 py-2 font-black" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}><RiShareLine /> Share</button>
              <button className="flex items-center gap-2 rounded-xl px-4 py-2 font-black" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}><RiAddLine /> My List</button>
            </div>
          </div>
          <div className="hidden overflow-hidden rounded-2xl border lg:block" style={{ borderColor: 'var(--color-border)' }}>
            {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full min-h-32 w-full object-cover" /> : null}
          </div>
        </div>

        {!locked && (
          <div className="my-6">
            <GoogleAdSlot placement="media" />
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-6 border-b pb-3" style={{ borderColor: 'var(--color-border)' }}>
          {['overview', 'episodes', 'related', 'comments'].map((tab) => (
            <button
              key={tab}
              className="font-black"
              style={{ color: activeInfoTab === tab ? 'var(--color-primary)' : 'var(--color-text-muted)' }}
              onClick={() => setActiveInfoTab(tab)}>
              {tab === 'related' ? 'More Like This' : tab === 'comments' ? 'Comments' : tab[0].toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {activeInfoTab === 'overview' && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]">
            <p className="text-sm leading-7" style={{ color: 'var(--color-text-muted)' }}>
              {media.description || 'No overview has been added for this media yet.'}
            </p>
            <div className="space-y-3 border-l pl-5 text-sm" style={{ borderColor: 'var(--color-border)', color: 'var(--color-text-muted)' }}>
              <p><b className="text-white">Director</b> {media.director || 'NendPlay Studios'}</p>
              <p><b className="text-white">Cast</b> {castText}</p>
              <p><b className="text-white">Genre</b> {genreText}</p>
            </div>
          </div>
        )}

        {activeInfoTab === 'episodes' && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {collectionItems.length > 1 ? collectionItems.map((item) => (
              <button
                key={item._id}
                type="button"
                onClick={() => item._id !== id && navigate(`/watch/${item._id}`)}
                className="flex gap-3 rounded-2xl p-3 text-left"
                style={{ background: item._id === id ? 'rgba(124,58,237,0.32)' : 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="aspect-video w-28 shrink-0 overflow-hidden rounded-xl bg-black/40">
                  {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-white">{getCollectionLabel(item)}</p>
                  <p className="truncate text-xs" style={{ color: 'var(--color-text-muted)' }}>{item.title}</p>
                </div>
              </button>
            )) : <p style={{ color: 'var(--color-text-muted)' }}>No episodes or parts are attached to this media yet.</p>}
          </div>
        )}

        {activeInfoTab === 'related' && (
          <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-6">
            {moreLikeThis.map((item) => <MediaCard key={item._id} media={item} size="full" />)}
          </div>
        )}

        {activeInfoTab === 'comments' && (
          <div className="mt-5 rounded-2xl p-4" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
            Comments will appear here when viewers start discussing this media.
          </div>
        )}

        {nextUp && (
          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1fr]">
            <div>
              <div className="mb-3 flex items-center gap-3">
                <h3 className="flex-1 text-xl font-black text-white">Next Up</h3>
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Auto Play</span>
                <button
                  className="h-7 w-12 rounded-full p-1"
                  style={{ background: autoPlayNext ? 'var(--color-primary)' : 'var(--color-surface-high)' }}
                  onClick={() => setAutoPlayNext((value) => !value)}>
                  <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${autoPlayNext ? 'translate-x-5' : ''}`} />
                </button>
              </div>
              <button onClick={() => nextUp._id !== id && navigate(`/watch/${nextUp._id}`)} className="flex w-full gap-4 rounded-2xl p-3 text-left" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <div className="aspect-video w-40 overflow-hidden rounded-xl bg-black/40">
                  {nextUp.thumbnailUrl ? <img src={nextUp.thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
                </div>
                <div>
                  <p className="font-black text-white">{nextUp.title}</p>
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{getCollectionLabel(nextUp)}</p>
                </div>
              </button>
            </div>
            {moreLikeThis.length > 0 && (
              <div>
                <h3 className="mb-3 text-xl font-black text-white">More Like This</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {moreLikeThis.slice(0, 3).map((item) => <MediaCard key={item._id} media={item} size="full" />)}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {!locked && (
        <div className="sticky bottom-0 z-20 mt-0 flex items-center gap-3 border-t px-4 py-3 backdrop-blur-xl" style={{ background: 'rgba(4,4,17,0.92)', borderColor: 'var(--color-border)' }}>
          <div className="aspect-video w-20 overflow-hidden rounded-xl bg-black/40">
            {thumbnailUrl ? <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" /> : null}
          </div>
          <p className="min-w-0 flex-1 truncate font-black text-white">{media.title}</p>
          <button onClick={() => setPlaying(!playing)} className="text-3xl text-white">{playing ? <RiPauseFill /> : <RiPlayFill />}</button>
          <button onClick={() => nextUp?._id && nextUp._id !== id && navigate(`/watch/${nextUp._id}`)} className="text-2xl text-white"><RiSkipForwardFill /></button>
          <button onClick={() => navigate(-1)} className="text-2xl text-white">×</button>
        </div>
      )}
    </div>
  )

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
                  upsertContinueWatching(media, { played, playedSeconds, duration })
                }}
                onDuration={(d) => { setLocalDuration(d); setDuration(d) }}
                onEnded={() => {
                  addWatchHistory(media, { duration })
                  removeContinueWatching(id)
                }}
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

            {!locked && (
              <div className="mt-5">
                <GoogleAdSlot placement="media" />
              </div>
            )}

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

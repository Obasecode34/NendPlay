import React, { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import ReactPlayer from 'react-player'
import { RiHeartLine, RiHeartFill, RiBookmarkLine, RiBookmarkFill,
  RiDownloadLine, RiShareLine, RiPlayFill, RiThumbDownLine, RiChat1Line,
  RiUserFollowLine } from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import { mediaService, downloadService } from '../services/index'
import { cacheDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloads'

function formatCount(value = 0) {
  const count = Number(value) || 0
  if (count >= 1000000) return `${(count / 1000000).toFixed(count >= 10000000 ? 0 : 1)}M`
  if (count >= 1000) return `${(count / 1000).toFixed(count >= 10000 ? 0 : 1)}K`
  return `${count}`
}

function ShortCard({ short, isActive, onActivate }) {
  const { ref, inView } = useInView({ threshold: 0.7 })
  const [playing, setPlaying] = useState(false)
  const [liked, setLiked] = useState(false)
  const [disliked, setDisliked] = useState(false)
  const [subscribed, setSubscribed] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(short.uploadedBy?.subscriberCount || 0)
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState(short.comments || [])
  const [commentText, setCommentText] = useState('')
  const [commentCount, setCommentCount] = useState(short.commentCount || (short.comments ? short.comments.length : 0))
  const [saved, setSaved] = useState(false)
  const [loadingComments, setLoadingComments] = useState(false)
  const shortFrameStyle = {
    height: 'min(820px, max(420px, calc(100vh - 190px)))',
    aspectRatio: '9 / 16',
    maxWidth: '100%',
    background: '#000',
  }

  useEffect(() => {
    if (inView) {
      onActivate(short._id)
      setPlaying(true)
    } else {
      setPlaying(false)
    }
  }, [inView])

  const handleLike = async (e) => {
    e.stopPropagation()
    if (liked) return
    try {
      await mediaService.like(short._id)
      setLiked(true)
      setCommentCount((prev) => prev)
    } catch {}
  }

  const handleDislike = async (e) => {
    e.stopPropagation()
    if (disliked) return
    try {
      await mediaService.dislike(short._id)
      setDisliked(true)
    } catch {}
  }

  const handleSave = async (e) => {
    e.stopPropagation()
    try {
      const res = await mediaService.save(short._id)
      toast.success(res.data.message || (res.data.data.saved ? 'Saved to your profile' : 'Removed from saved'))
      setSaved(res.data.data.saved)
    } catch {
      toast.error('Unable to update saved status')
    }
  }

  const handleDownload = async (e) => {
    e.stopPropagation()
    try {
      const deviceId = window.navigator.userAgent.slice(0, 64)
      const res = await downloadService.authorize({
        contentType: 'media',
        contentId: short._id,
        deviceId,
        platform: 'web',
      })
      if (res.data.data.alreadyDownloaded) {
        toast.success('Already downloaded')
        return
      }
      const fileUrl = res.data.data.fileUrl || mediaService.getStreamUrl(short._id)
      const cachedFile = await cacheDownloadFile({
        fileUrl,
        contentType: 'media',
        contentId: short._id,
      })
      upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'media',
        contentId: short._id,
        storageKey: cachedFile.storageKey,
        storedFileSize: cachedFile.storedFileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: short.title || res.data.data.title || 'short',
          thumbnailUrl: short.thumbnailUrl || '',
          type: short.type || 'short',
          category: short.category || '',
          duration: short.duration || 0,
          mimeType: short.mimeType || res.data.data.mimeType || '',
          fileUrl,
        },
      })
      if (res.data.data.download?._id) {
        await downloadService.complete({
          downloadId: res.data.data.download._id,
          storageKey: cachedFile.storageKey,
          storedFileSize: cachedFile.storedFileSize || res.data.data.fileSize || 0,
        })
      }
      toast.success('Saved to Downloads for offline playback')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Download failed')
    }
  }

  const handleShare = async (e) => {
    e.stopPropagation()
    const shareUrl = `${window.location.origin}/watch/${short._id}`
    try {
      if (navigator.share) {
        await navigator.share({
          title: short.title,
          text: `Watch ${short.title} on NendPlay`,
          url: shareUrl,
        })
      } else {
        await navigator.clipboard.writeText(`${short.title} — ${shareUrl}`)
        toast.success('Share link copied to clipboard')
      }
    } catch {
      toast.error('Unable to share this short')
    }
  }

  const handleToggleComments = async (e) => {
    e.stopPropagation()
    const nextOpen = !showComments
    setShowComments(nextOpen)
    if (!nextOpen) {
      setCommentText('')
      return
    }
    if (comments.length === 0) {
      setLoadingComments(true)
      try {
        const res = await mediaService.getById(short._id)
        setComments(res.data.data.media.comments || [])
      } catch {} finally {
        setLoadingComments(false)
      }
    }
  }

  const handleSubmitComment = async (e) => {
    e.stopPropagation()
    if (!commentText.trim()) return
    try {
      const res = await mediaService.comment(short._id, { text: commentText.trim() })
      setCommentCount((prev) => prev + 1)
      const newComment = res.data.data.comment
      if (newComment) {
        setComments((prev) => [...prev, newComment])
      }
      setCommentText('')
      setShowComments(false)
    } catch {}
  }

  const handleSubscribe = async (e) => {
    e.stopPropagation()
    const creatorId = short.uploadedBy?._id || short.uploadedBy?.id
    if (!creatorId) return

    try {
      const res = await mediaService.subscribeCreator(creatorId)
      setSubscribed(res.data.data.subscribed)
      setSubscriberCount(res.data.data.subscriberCount || 0)
      toast.success(res.data.message || (res.data.data.subscribed ? 'Subscribed' : 'Subscription removed'))
    } catch (err) {
      toast.error(err.response?.data?.message || 'Unable to update subscription')
    }
  }

  return (
    <div id={`short-${short._id}`} ref={ref}
      className="relative flex-shrink-0 rounded-2xl overflow-hidden cursor-pointer shadow-2xl"
      style={shortFrameStyle}
      onClick={() => setPlaying(!playing)}>

      {/* Player */}
      <ReactPlayer
        url={mediaService.getStreamUrl(short._id)}
        playing={playing && isActive}
        muted={false}
        loop
        width="100%"
        height="100%"
        style={{ objectFit: 'cover' }}
        config={{ file: { attributes: { style: { objectFit: 'cover', width: '100%', height: '100%' } } } }}
      />

      {/* Gradient overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 50%)' }} />

      {/* Play/pause indicator */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}>
            <RiPlayFill className="text-white text-3xl ml-1" />
          </div>
        </div>
      )}

      {/* Bottom info */}
      <div className="absolute bottom-0 left-0 right-0 p-5">
        <div className="flex items-end justify-between gap-4">
          <div className="flex-1 min-w-0">
            <p className="font-display font-bold text-white text-lg leading-tight truncate">
              {short.title}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <p className="text-white/80 text-sm font-semibold">
                @{short.uploadedBy?.username || short.uploadedBy?.profileName || 'creator'}
              </p>
              <button
                onClick={handleSubscribe}
                className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${
                  subscribed ? 'bg-white/15 text-white' : 'bg-white text-black'
                }`}
              >
                {subscribed ? 'Subscribed' : 'Subscribe'}
              </button>
              {subscriberCount > 0 && (
                <span className="text-white/50 text-xs">
                  {formatCount(subscriberCount)} subscribers
                </span>
              )}
            </div>
            {short.description && (
              <p className="text-white/50 text-xs mt-1 line-clamp-2">
                {short.description}
              </p>
            )}
          </div>

          {/* Side actions */}
          <div className="flex flex-col items-center gap-4">
            <button onClick={handleLike}
              className="flex flex-col items-center gap-1">
              {liked
                ? <RiHeartFill className="text-2xl text-red-500" />
                : <RiHeartLine className="text-2xl text-white" />
              }
              <span className="text-white text-xs">{short.likeCount + (liked ? 1 : 0)}</span>
            </button>

            <button onClick={handleDislike}
              className="flex flex-col items-center gap-1">
              {disliked
                ? <RiThumbDownLine className="text-2xl text-blue-400" />
                : <RiThumbDownLine className="text-2xl text-white" />
              }
              <span className="text-white text-xs">{short.dislikeCount + (disliked ? 1 : 0)}</span>
            </button>

            <button onClick={handleToggleComments}
              className="flex flex-col items-center gap-1">
              <RiChat1Line className="text-2xl text-white" />
              <span className="text-white text-xs">{commentCount}</span>
            </button>

            <button onClick={handleSave}
              className="flex flex-col items-center gap-1">
              {saved
                ? <RiBookmarkFill className="text-2xl text-yellow-300" />
                : <RiBookmarkLine className="text-2xl text-white" />
              }
              <span className="text-white text-xs">{saved ? 'Saved' : 'Save'}</span>
            </button>

            <button onClick={handleDownload}
              className="flex flex-col items-center gap-1">
              <RiDownloadLine className="text-2xl text-white" />
              <span className="text-white text-xs">Download</span>
            </button>

            <button onClick={handleShare}
              className="flex flex-col items-center gap-1">
              <RiShareLine className="text-2xl text-white" />
              <span className="text-white text-xs">Share</span>
            </button>
          </div>
        </div>
      </div>

      {showComments && (
        <div className="absolute left-4 right-4 bottom-28 bg-black/90 rounded-3xl p-4 border border-white/10 backdrop-blur-lg">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-white text-sm font-semibold">Comments ({commentCount})</span>
            <button onClick={handleToggleComments} className="text-white/60 text-sm">Close</button>
          </div>
          <div className="max-h-44 overflow-y-auto space-y-3 mb-3">
            {loadingComments ? (
              <div className="text-white/70 text-sm">Loading comments…</div>
            ) : comments.length > 0 ? (
              comments.slice(-4).reverse().map((comment, index) => (
                <div key={comment._id || index} className="space-y-1">
                  <p className="text-white text-sm font-semibold">
                    {comment.user?.username || comment.user || 'User'}
                  </p>
                  <p className="text-white/80 text-xs">{comment.text}</p>
                </div>
              ))
            ) : (
              <p className="text-white/60 text-sm">No comments yet. Be the first to comment.</p>
            )}
          </div>
          <div className="space-y-2">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment..."
              className="w-full rounded-2xl border border-white/10 bg-white/5 p-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-primary"
              rows={3}
            />
            <button
              onClick={handleSubmitComment}
              className="w-full rounded-2xl bg-primary py-2 text-sm font-semibold text-white"
            >Post</button>
          </div>
        </div>
      )}

      {/* Duration badge */}
      {short.duration > 0 && (
        <div className="absolute top-3 right-3 px-2 py-1 rounded-lg text-xs font-mono text-white"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          {Math.floor(short.duration / 60)}:{String(Math.floor(short.duration % 60)).padStart(2, '0')}
        </div>
      )}
    </div>
  )
}

export default function ShortsPage() {
  const [shorts, setShorts] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [feedMode, setFeedMode] = useState('all')
  const [searchParams] = useSearchParams()
  const openShortId = searchParams.get('open')

  useEffect(() => { fetchShorts() }, [page, feedMode])

  const fetchShorts = async () => {
    try {
      const serviceCall = feedMode === 'subscriptions'
        ? mediaService.getSubscribedShorts
        : mediaService.getShorts
      const res = await serviceCall({ page, limit: 10 })
      const { media, pagination } = res.data.data
      setShorts(prev => page === 1 ? media : [...prev, ...media])
      setHasMore(page < pagination.pages)
    } catch {
      toast.error('Failed to load Shorts')
    } finally {
      setLoading(false)
    }
  }

  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ threshold: 1 })

  useEffect(() => {
    if (loadMoreInView && hasMore && !loading) {
      setPage(prev => prev + 1)
    }
  }, [loadMoreInView])

  const switchFeedMode = (nextMode) => {
    if (nextMode === feedMode) return
    setFeedMode(nextMode)
    setShorts([])
    setActiveId(null)
    setPage(1)
    setHasMore(true)
    setLoading(true)
  }

  useEffect(() => {
    if (!openShortId || loading) return
    const existing = shorts.find((short) => short._id === openShortId)
    if (existing) {
      setActiveId(openShortId)
      setTimeout(() => {
        document.getElementById(`short-${openShortId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 50)
      return
    }

    const loadShort = async () => {
      try {
        const res = await mediaService.getById(openShortId)
        const fetched = res.data.data.media
        if (fetched) {
          setShorts((prev) => [fetched, ...prev.filter((short) => short._id !== fetched._id)])
          setActiveId(openShortId)
          setTimeout(() => {
            document.getElementById(`short-${openShortId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
          }, 50)
        }
      } catch {
      }
    }

    loadShort()
  }, [openShortId, shorts, loading])

  if (loading && page === 1) {
    return (
      <div className="mx-auto flex w-full flex-col items-center space-y-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="skeleton rounded-2xl"
            style={{
              height: 'min(820px, max(420px, calc(100vh - 190px)))',
              aspectRatio: '9 / 16',
              maxWidth: '100%',
            }}
          />
        ))}
      </div>
    )
  }

  if (!loading && shorts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
          <RiPlayFill className="text-2xl" />
        </div>
        <p className="font-display font-bold text-xl mb-2" style={{ color: 'var(--color-text)' }}>
          No Shorts yet
        </p>
        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Upload videos under 3 minutes to appear here
        </p>
      </div>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-3xl gradient-text">Shorts</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
            Quick videos under 3 minutes
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => switchFeedMode('all')}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              feedMode === 'all' ? 'bg-primary text-white' : 'bg-white/10 text-white'
            }`}
          >
            All
          </button>
          <button
            onClick={() => switchFeedMode('subscriptions')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition ${
              feedMode === 'subscriptions' ? 'bg-primary text-white' : 'bg-white/10 text-white'
            }`}
          >
            <RiUserFollowLine />
            Subscriptions
          </button>
        </div>
      </div>

      {/* Vertical scroll feed — centered like TikTok */}
      <div className="mx-auto flex w-full flex-col items-center space-y-4">
        {shorts.map((short) => (
          <ShortCard
            key={short._id}
            short={short}
            isActive={activeId === short._id}
            onActivate={setActiveId}
          />
        ))}

        {/* Load more trigger */}
        {hasMore && (
          <div ref={loadMoreRef} className="flex justify-center py-4">
            <div className="w-6 h-6 border-2 border-transparent rounded-full animate-spin"
              style={{ borderTopColor: 'var(--color-primary)' }} />
          </div>
        )}
      </div>
    </div>
  )
}

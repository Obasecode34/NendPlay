import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { RiArrowLeftLine, RiChat3Line, RiHeartLine, RiShareForwardLine, RiSendPlaneFill } from 'react-icons/ri'
import ReactPlayer from 'react-player'
import { newsService } from '../services'
import useAuthStore from '../stores/authStore'
import { InArticleAd, MultiplexAd } from '../components/ads/GoogleAdSlot'

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const hours = Math.floor(diff / 3600000)
  if (hours < 24) return `${Math.max(hours, 1)} hour${hours <= 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function Avatar({ user, size = 42 }) {
  const name = user?.profileName || user?.username || 'User'
  if (user?.profilePic) {
    return <img src={user.profilePic} alt="" className="rounded-full object-cover" style={{ width: size, height: size }} />
  }
  return (
    <div className="flex shrink-0 items-center justify-center rounded-full font-black text-white"
      style={{ width: size, height: size, background: 'var(--color-primary)' }}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}

function Comment({ item, onReply, onLike }) {
  const name = item.user?.profileName || item.user?.username || 'NendPlay user'
  return (
    <div className="rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
      <div className="flex gap-3">
        <Avatar user={item.user} />
        <div className="min-w-0 flex-1">
          <p className="font-black" style={{ color: 'var(--color-text)' }}>{name}</p>
          <p className="mt-1 text-sm leading-6" style={{ color: 'var(--color-text)' }}>{item.text}</p>
          <div className="mt-3 flex items-center gap-4 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
            <span>{timeAgo(item.createdAt)}</span>
            <button type="button" onClick={() => onReply(item)}>Reply</button>
            <button type="button" onClick={() => onLike(item)} className="inline-flex items-center gap-1">
              <RiHeartLine /> {item.likeCount || 0}
            </button>
          </div>
          {item.replies?.length > 0 && (
            <div className="mt-4 space-y-3 border-l pl-4" style={{ borderColor: 'var(--color-border)' }}>
              {item.replies.map((reply) => (
                <div key={reply._id} className="flex gap-3">
                  <Avatar user={reply.user} size={30} />
                  <div>
                    <p className="text-sm font-black" style={{ color: 'var(--color-text)' }}>
                      {reply.user?.profileName || reply.user?.username || 'NendPlay user'}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--color-text)' }}>{reply.text}</p>
                    <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>{timeAgo(reply.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewsArticlePage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [comment, setComment] = useState('')
  const [replyTarget, setReplyTarget] = useState(null)

  const videos = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'video'), [post])
  const audios = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'audio'), [post])
  const images = useMemo(() => (post?.mediaFiles || []).filter((item) => item.type === 'image'), [post])
  const paragraphs = useMemo(() => String(post?.body || '').split(/\n{2,}/).filter(Boolean), [post])
  const articleAdPlacement = post?.section === 'news' ? 'news' : 'all'
  const shouldShowInArticleAd = (index) => post?.adsEnabled && (index === 0 || (index + 1) % 4 === 0)

  useEffect(() => {
    loadPost()
  }, [id])

  const loadPost = async () => {
    setLoading(true)
    try {
      const res = await newsService.getPost(id)
      setPost(res.data.data.post)
    } catch {
      toast.error('News post could not be loaded')
      navigate('/news')
    } finally {
      setLoading(false)
    }
  }

  const submitComment = async (event) => {
    event.preventDefault()
    if (!isAuthenticated) {
      toast.error('Please sign in to comment')
      return
    }
    if (!comment.trim()) return
    try {
      const res = replyTarget
        ? await newsService.reply(id, replyTarget._id, { text: comment.trim() })
        : await newsService.comment(id, { text: comment.trim() })
      setPost(res.data.data.post)
      setComment('')
      setReplyTarget(null)
    } catch {
      toast.error('Could not send comment')
    }
  }

  const likePost = async () => {
    if (!isAuthenticated) return toast.error('Please sign in to like news')
    try {
      const res = await newsService.like(id)
      const data = res.data?.data || {}
      setPost((current) => current ? { ...current, likeCount: data.likeCount ?? current.likeCount } : current)
    } catch {
      toast.error('Could not like post')
    }
  }

  const likeComment = async (item) => {
    if (!isAuthenticated) return toast.error('Please sign in to like comments')
    try {
      const res = await newsService.likeComment(id, item._id)
      setPost(res.data.data.post)
    } catch {
      toast.error('Could not like comment')
    }
  }

  const sharePost = async () => {
    const url = `${window.location.origin}/news/${id}`
    try {
      await newsService.share(id)
      if (navigator.share) await navigator.share({ title: post?.header || post?.title, url })
      else {
        await navigator.clipboard.writeText(url)
        toast.success('News link copied')
      }
      setPost((current) => current ? { ...current, shareCount: (current.shareCount || 0) + 1 } : current)
    } catch {}
  }

  if (loading) return <div className="h-96 skeleton rounded-2xl" />
  if (!post) return null

  return (
    <div className="mx-auto max-w-4xl animate-fade-in pb-24">
      <button type="button" onClick={() => navigate(-1)} className="btn-ghost mb-5 inline-flex items-center gap-2 px-4 py-2 text-sm">
        <RiArrowLeftLine /> Back
      </button>

      <h1 className="font-display text-4xl font-black leading-tight md:text-5xl" style={{ color: 'var(--color-text)' }}>
        {post.header || post.title}
      </h1>
      {post.subHeader && <p className="mt-4 text-lg" style={{ color: 'var(--color-text-muted)' }}>{post.subHeader}</p>}
      <div className="mt-5 flex flex-wrap items-center gap-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <span className="font-black">{post.source || 'NendPlay News'}</span>
        <span>•</span>
        <span>{timeAgo(post.publishedAt)}</span>
      </div>

      <div className="mt-8 space-y-5">
        {videos.map((item, index) => (
          <div key={`${item.url}-${index}`} className="overflow-hidden rounded-2xl bg-black">
            <ReactPlayer url={item.url} width="100%" height="420px" controls playsinline />
          </div>
        ))}
        {audios.map((item, index) => (
          <div key={`${item.url}-${index}`} className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <p className="mb-3 text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>Audio report</p>
            <audio src={item.url} controls className="w-full" />
          </div>
        ))}
        {images.map((item, index) => (
          <img key={`${item.url}-${index}`} src={item.url} alt="" className="w-full rounded-2xl object-cover" />
        ))}
      </div>

      <div className="mt-8 space-y-7">
        {paragraphs.map((text, index) => (
          <React.Fragment key={index}>
            <p className="text-xl leading-9" style={{ color: 'var(--color-text)' }}>{text}</p>
            {shouldShowInArticleAd(index) && <InArticleAd placement={articleAdPlacement} />}
          </React.Fragment>
        ))}
      </div>

      <div className="mt-8 flex items-center justify-around rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <button type="button" className="flex items-center gap-2 font-black" style={{ color: 'var(--color-text)' }}>
          <RiChat3Line /> {post.commentCount || post.comments?.length || 0}
        </button>
        <button type="button" onClick={likePost} className="flex items-center gap-2 font-black" style={{ color: 'var(--color-text)' }}>
          <RiHeartLine /> {post.likeCount || 0}
        </button>
        <button type="button" onClick={sharePost} className="flex items-center gap-2 font-black" style={{ color: 'var(--color-text)' }}>
          <RiShareForwardLine /> {post.shareCount || 0}
        </button>
      </div>

      {post.adsEnabled && <MultiplexAd placement={articleAdPlacement} className="mt-8" />}

      <section className="mt-10">
        <h2 className="mb-4 text-2xl font-black" style={{ color: 'var(--color-text)' }}>Comments</h2>
        <form onSubmit={submitComment} className="mb-5 rounded-2xl p-4" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {replyTarget && (
            <div className="mb-3 flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold" style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
              Replying to {replyTarget.user?.profileName || replyTarget.user?.username || 'comment'}
              <button type="button" onClick={() => setReplyTarget(null)}>Cancel</button>
            </div>
          )}
          <div className="flex gap-3">
            <input
              className="input-base flex-1"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={replyTarget ? 'Write a reply...' : "Let's talk about it"}
            />
            <button type="submit" className="btn-primary px-4"><RiSendPlaneFill /></button>
          </div>
        </form>

        <div className="space-y-4">
          {(post.comments || []).length === 0 ? (
            <p className="text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>No comments yet.</p>
          ) : post.comments.map((item) => (
            <Comment key={item._id} item={item} onReply={setReplyTarget} onLike={likeComment} />
          ))}
        </div>
      </section>
    </div>
  )
}

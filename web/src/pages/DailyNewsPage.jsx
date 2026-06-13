import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { RiGlobalLine, RiSearchLine, RiNewspaperLine, RiTimeLine } from 'react-icons/ri'
import { newsService } from '../services'

const NEWS_TABS = [
  { value: 'for-you', label: 'For you' },
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

function timeAgo(value) {
  if (!value) return 'Today'
  const diff = Date.now() - new Date(value).getTime()
  if (Number.isNaN(diff) || diff < 0) return 'Today'
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${Math.max(minutes, 1)} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? 'Yesterday' : `${days} days ago`
}

function NewsCard({ article, featured = false, onOpen }) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onOpen(article)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen(article)
      }}
      className={`cursor-pointer rounded-2xl transition-transform hover:-translate-y-1 ${featured ? 'p-0' : 'p-4'}`}
      style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
    >
      {article.imageUrl && (
        <div className={`overflow-hidden ${featured ? 'rounded-t-2xl aspect-[16/8]' : 'rounded-xl aspect-video mb-4'}`}>
          <img src={article.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        </div>
      )}
      <div className={featured ? 'p-5' : ''}>
        <div className="mb-3 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          <RiNewspaperLine style={{ color: 'var(--color-primary)' }} />
          <span className="font-bold">{article.source || 'NendPlay News'}</span>
          <span>•</span>
          <RiTimeLine />
          <span>{timeAgo(article.publishedAt)}</span>
        </div>
        <h2 className={`${featured ? 'text-3xl' : 'text-xl'} font-black leading-tight`} style={{ color: 'var(--color-text)' }}>
          {article.header || article.title}
        </h2>
        {(article.subHeader || article.summary) && (
          <p className="mt-3 line-clamp-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {article.subHeader || article.summary}
          </p>
        )}
      </div>
    </article>
  )
}

export default function DailyNewsPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [articles, setArticles] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [search, setSearch] = useState(searchParams.get('search') || '')
  const activeTab = searchParams.get('tab') || 'for-you'

  const params = useMemo(() => ({
    tab: activeTab,
    search: searchParams.get('search') || undefined,
    country: 'Nigeria',
    page: Number(searchParams.get('page') || 1),
    limit: 12,
  }), [activeTab, searchParams])

  useEffect(() => {
    loadNews(1, false)
  }, [activeTab, searchParams.get('search')])

  const loadNews = async (page = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await newsService.getDailyNews({ ...params, page })
      const payload = res.data?.data?.data || res.data?.data || {}
      setArticles((current) => append ? [...current, ...(payload.articles || [])] : (payload.articles || []))
      setPagination(payload.pagination || null)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const openArticle = (article) => {
    if (article.kind === 'nendplay' || article._id) {
      navigate(`/news/${article._id || article.id}`)
      return
    }
    if (article.url) window.open(article.url, '_blank', 'noopener,noreferrer')
  }

  const submitSearch = (event) => {
    event.preventDefault()
    setSearchParams({ tab: activeTab, ...(search.trim() ? { search: search.trim() } : {}) })
  }

  const featured = articles[0]
  const rest = articles.slice(1)

  return (
    <div className="animate-fade-in pb-20">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-2xl"
            style={{ background: 'var(--color-primary)', color: '#fff' }}>
            <RiGlobalLine className="text-2xl" />
          </div>
          <h1 className="font-display text-4xl font-black" style={{ color: 'var(--color-text)' }}>News Globe</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>Live stories, local updates, and NendPlay editorials.</p>
        </div>
        <form onSubmit={submitSearch} className="relative w-full max-w-md">
          <RiSearchLine className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
          <input
            className="input-base py-3 pl-11"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search news..."
          />
        </form>
      </div>

      <div className="mb-6 flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {NEWS_TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setSearchParams({ tab: tab.value, ...(search.trim() ? { search: search.trim() } : {}) })}
            className="whitespace-nowrap rounded-2xl px-4 py-2 text-sm font-black"
            style={{
              background: activeTab === tab.value ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === tab.value ? '#fff' : 'var(--color-text-muted)',
              border: '1px solid var(--color-border)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4">
          <div className="h-80 skeleton rounded-2xl" />
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-56 skeleton rounded-2xl" />
            <div className="h-56 skeleton rounded-2xl" />
          </div>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
          No news found.
        </div>
      ) : (
        <>
          {featured && <div className="mb-5"><NewsCard article={featured} featured onOpen={openArticle} /></div>}
          <div className="grid gap-4 lg:grid-cols-2">
            {rest.map((article, index) => (
              <NewsCard key={article._id || article.id || index} article={article} onOpen={openArticle} />
            ))}
          </div>
          {pagination && pagination.page < pagination.pages && (
            <div className="mt-8 flex justify-center">
              <button className="btn-primary px-5 py-3 text-sm" disabled={loadingMore} onClick={() => loadNews((pagination.page || 1) + 1, true)}>
                {loadingMore ? 'Loading...' : 'Load more news'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

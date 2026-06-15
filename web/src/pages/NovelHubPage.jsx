import React, { useEffect, useMemo, useState } from 'react'
import {
  RiBookOpenLine, RiDownloadLine, RiFileCopyLine, RiHeartLine, RiSearchLine,
  RiUploadLine, RiFileTextLine, RiCloseLine, RiShareForwardLine, RiLockLine,
  RiFolderOpenLine, RiAddLine,
} from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import { downloadService, novelService } from '../services/index'
import { cacheDownloadFile, upsertLocalDownloadRecord } from '../services/localDownloads'
import { getDeviceId } from '../services/guestSession'
import useAuthStore from '../stores/authStore'
import DownloadsPage from './DownloadsPage'
import GoogleAdSlot from '../components/ads/GoogleAdSlot'

const DOCUMENT_PAGE_LIMIT = 60

const TOP_TABS = [
  { key: 'novels', label: 'NovelHub', icon: RiBookOpenLine },
  { key: 'downloads', label: 'Downloads', icon: RiDownloadLine },
  { key: 'office', label: 'NP Office', icon: RiFolderOpenLine },
]

const PDF_GENRES = [
  { key: 'business', label: 'Business' },
  { key: 'love', label: 'Love' },
  { key: 'finance', label: 'Finance' },
  { key: 'drama', label: 'Drama' },
  { key: 'fiction', label: 'Fiction' },
  { key: 'non-fiction', label: 'Non-Fiction' },
  { key: 'mystery', label: 'Mystery' },
  { key: 'horror', label: 'Horror' },
  { key: 'fan-fiction', label: 'Fan Fiction' },
  { key: 'sci-fi', label: 'Sci-Fi' },
  { key: 'urban', label: 'Urban' },
  { key: 'teen', label: 'Teen' },
  { key: 'military-history', label: 'Military & History' },
  { key: 'games-sport', label: 'Games & Sport' },
  { key: 'literature', label: 'Literature' },
  { key: 'eastern-fantasy', label: 'Eastern Fantasy' },
  { key: 'western-fantasy', label: 'Western Fantasy' },
]

const LICENSE_TYPES = [
  { value: 'unknown', label: 'Rights not set yet' },
  { value: 'public_domain', label: 'Public domain' },
  { value: 'cc0', label: 'Creative Commons CC0' },
  { value: 'cc_by', label: 'Creative Commons BY' },
  { value: 'cc_by_sa', label: 'Creative Commons BY-SA' },
  { value: 'cc_by_nc', label: 'Creative Commons BY-NC' },
  { value: 'cc_by_nc_sa', label: 'Creative Commons BY-NC-SA' },
  { value: 'cc_by_nd', label: 'Creative Commons BY-ND' },
  { value: 'cc_by_nc_nd', label: 'Creative Commons BY-NC-ND' },
  { value: 'standard_license', label: 'Standard licensed content' },
  { value: 'owned', label: 'Owned by NendPlay/uploader' },
  { value: 'permission_granted', label: 'Permission granted' },
]

const OFFICE_TYPES = {
  pdf: 'PDF',
  txt: 'Text',
  csv: 'CSV',
  doc: 'Word',
  docx: 'Word',
  ppt: 'PowerPoint',
  pptx: 'PowerPoint',
  xls: 'Excel',
  xlsx: 'Excel',
}

function normalizeGenre(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function getDocumentGenre(item = {}) {
  const raw = item.category || item.genre || item.tags?.[0] || 'fiction'
  const normalized = normalizeGenre(raw)
  return PDF_GENRES.some((genre) => genre.key === normalized) ? normalized : 'fiction'
}

function scoreDocument(item = {}) {
  return (item.viewCount || 0) + (item.downloadCount || 0) * 2 + (item.likeCount || 0) * 3 + (item.forkCount || 0) * 2
}

function getCoverColors(item = {}) {
  const palettes = [
    ['#173B5F', '#4F46E5'],
    ['#064E3B', '#0D9488'],
    ['#4C1D95', '#DB2777'],
    ['#7F1D1D', '#EA580C'],
    ['#111827', '#475569'],
    ['#312E81', '#0891B2'],
  ]
  const seed = `${item._id || item.title || ''}`.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return palettes[seed % palettes.length]
}

function SectionHeader({ title, onViewAll }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-2xl font-black" style={{ color: 'var(--color-text)' }}>{title}</h2>
      {onViewAll && (
        <button onClick={onViewAll} className="text-sm font-bold" style={{ color: 'var(--color-text-muted)' }}>
          View all
        </button>
      )}
    </div>
  )
}

function OfficeWorkspace() {
  const [files, setFiles] = useState([])
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(null)

  const pickFiles = (event) => {
    const next = Array.from(event.target.files || []).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}`,
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      ext: file.name.split('.').pop()?.toLowerCase() || 'file',
      url: URL.createObjectURL(file),
    }))
    setFiles((current) => [...next, ...current.filter((item) => !next.some((file) => file.id === item.id))])
  }

  const filtered = files.filter((item) => item.name.toLowerCase().includes(query.toLowerCase()))
  const canPreview = selected && (selected.type === 'application/pdf' || ['pdf', 'txt', 'csv'].includes(selected.ext))

  return (
    <div className="space-y-5">
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="font-display text-2xl font-black" style={{ color: 'var(--color-text)' }}>NendPlay Office</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              PDF, Word, Excel, PowerPoint, TXT and CSV workspace.
            </p>
          </div>
          <label className="btn-primary inline-flex cursor-pointer items-center justify-center gap-2">
            <RiAddLine /> Add Documents
            <input
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.txt,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx,application/pdf,text/*"
              onChange={pickFiles}
            />
          </label>
        </div>
      </div>

      <div className="relative">
        <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search local documents"
          className="input-base pl-10"
        />
      </div>

      {files.length === 0 ? (
        <div className="rounded-2xl p-10 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          <RiFolderOpenLine className="mx-auto mb-3 text-5xl" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>No NP Office files yet</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Add files from this browser to preview supported documents inside NendPlay.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-3">
            {filtered.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="flex w-full items-center gap-3 rounded-2xl p-4 text-left"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}
              >
                <RiFileTextLine className="text-2xl" style={{ color: 'var(--color-primary)' }} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold" style={{ color: 'var(--color-text)' }}>{item.name}</p>
                  <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {OFFICE_TYPES[item.ext] || 'Document'} | {(item.size / 1024).toFixed(1)} KB
                  </p>
                </div>
                <span className="rounded-lg px-2 py-1 text-xs font-black uppercase" style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)' }}>
                  {item.ext}
                </span>
              </button>
            ))}
          </div>

          <div className="min-h-[520px] overflow-hidden rounded-2xl" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            {!selected ? (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <RiFileTextLine className="mb-3 text-5xl" style={{ color: 'var(--color-text-muted)' }} />
                <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>Preview ready</p>
                <p className="mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  Select a PDF, TXT or CSV file to preview. Office files stay listed and can be opened in a compatible desktop app.
                </p>
              </div>
            ) : canPreview ? (
              selected.ext === 'txt' || selected.ext === 'csv' ? (
                <iframe title={selected.name} src={selected.url} className="h-[620px] w-full bg-white" />
              ) : (
                <iframe title={selected.name} src={selected.url} className="h-[620px] w-full bg-white" />
              )
            ) : (
              <div className="flex h-full min-h-[520px] flex-col items-center justify-center p-8 text-center">
                <RiFileTextLine className="mb-3 text-5xl" style={{ color: 'var(--color-primary)' }} />
                <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>{selected.name}</p>
                <p className="mt-2 max-w-md text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {OFFICE_TYPES[selected.ext] || 'This file'} needs a compatible viewer such as WPS Office, Microsoft Office, Google Docs, Sheets or Slides.
                </p>
                <a href={selected.url} download={selected.name} className="btn-primary mt-5 inline-flex">Open Document</a>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function NovelHubPage() {
  const { isAuthenticated } = useAuthStore()
  const [activeTopTab, setActiveTopTab] = useState('novels')
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [genre, setGenre] = useState('all')
  const [selectedPdf, setSelectedPdf] = useState(null)
  const [showUpload, setShowUpload] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ rootMargin: '320px' })
  const [uploadForm, setUploadForm] = useState({
    title: '', description: '', category: 'fiction',
    author: '', tags: '', licenseType: 'unknown',
    sourceName: '', sourceUrl: '', licenseUrl: '',
    attributionText: '', rightsSummary: '', requiresAttribution: false,
    file: null,
  })

  useEffect(() => { fetchDocuments(1, false) }, [search, genre])

  useEffect(() => {
    if (!loadMoreInView || loading || loadingMore || !hasMore || activeTopTab !== 'novels') return
    fetchDocuments(page + 1, true)
  }, [loadMoreInView, loading, loadingMore, hasMore, page, activeTopTab])

  const fetchDocuments = async (pageToLoad = 1, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const params = { limit: DOCUMENT_PAGE_LIMIT, page: pageToLoad, fileType: 'pdf' }
      if (search) params.search = search
      if (genre !== 'all') params.category = genre
      const res = await novelService.getAll(params)
      const nextDocuments = res.data.data.documents || []
      const pagination = res.data.data.pagination || {}
      setDocuments((current) => append ? [...current, ...nextDocuments] : nextDocuments)
      setPage(pageToLoad)
      setHasMore(pageToLoad < (pagination.pages || 1))
    } catch {
      toast.error('Failed to load documents')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const genreByKey = useMemo(() => PDF_GENRES.reduce((acc, item) => ({ ...acc, [item.key]: item }), {}), [])
  const rankedDocuments = useMemo(() => [...documents].sort((a, b) => scoreDocument(b) - scoreDocument(a)), [documents])
  const recentDocuments = documents.slice(0, 10)
  const bestDocuments = rankedDocuments.slice(0, 8)
  const categorySections = PDF_GENRES.map((item) => ({
    ...item,
    items: documents.filter((doc) => getDocumentGenre(doc) === item.key).slice(0, 8),
  })).filter((section) => section.items.length)

  const handleUpload = async (event) => {
    event.preventDefault()
    if (!uploadForm.file || !uploadForm.title) {
      toast.error('Please provide a title and PDF file')
      return
    }
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('document', uploadForm.file)
      formData.append('title', uploadForm.title)
      formData.append('description', uploadForm.description)
      formData.append('category', uploadForm.category)
      formData.append('genre', uploadForm.category)
      formData.append('author', uploadForm.author)
      formData.append('tags', uploadForm.tags)
      formData.append('licenseType', uploadForm.licenseType)
      formData.append('sourceName', uploadForm.sourceName)
      formData.append('sourceUrl', uploadForm.sourceUrl)
      formData.append('licenseUrl', uploadForm.licenseUrl)
      formData.append('attributionText', uploadForm.attributionText)
      formData.append('rightsSummary', uploadForm.rightsSummary)
      formData.append('requiresAttribution', uploadForm.requiresAttribution.toString())
      await novelService.upload(formData)
      toast.success('PDF uploaded to NovelHub')
      setShowUpload(false)
      setUploadForm({
        title: '', description: '', category: 'fiction',
        author: '', tags: '', licenseType: 'unknown',
        sourceName: '', sourceUrl: '', licenseUrl: '',
        attributionText: '', rightsSummary: '', requiresAttribution: false,
        file: null,
      })
      fetchDocuments(1, false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleFork = async (id) => {
    try {
      await novelService.fork(id)
      toast.success('Document forked. Check your profile.')
      fetchDocuments(1, false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Fork failed')
    }
  }

  const handleDownload = async (doc) => {
    try {
      const deviceId = getDeviceId()
      const res = await downloadService.authorize({
        contentType: 'document',
        contentId: doc._id,
        deviceId,
        platform: 'web',
      })
      const fileUrl = res.data.data.fileUrl || doc.fileUrl
      const cachedFile = await cacheDownloadFile({ fileUrl, contentType: 'document', contentId: doc._id })
      upsertLocalDownloadRecord({
        download: res.data.data.download,
        contentType: 'document',
        contentId: doc._id,
        storageKey: cachedFile.storageKey,
        storedFileSize: cachedFile.storedFileSize || doc.fileSize || res.data.data.fileSize || 0,
        snapshot: {
          title: doc.title || res.data.data.title || 'PDF document',
          thumbnailUrl: doc.thumbnailUrl || '',
          type: doc.fileType || 'pdf',
          category: doc.category || doc.genre || '',
          mimeType: doc.mimeType || res.data.data.mimeType || 'application/pdf',
          fileUrl,
          licenseType: doc.licenseType || 'unknown',
          sourceName: doc.sourceName || '',
          sourceUrl: doc.sourceUrl || '',
          licenseUrl: doc.licenseUrl || '',
          attributionText: doc.attributionText || '',
        },
      })
      if (res.data.data.download?._id) {
        try {
          await downloadService.complete({
            downloadId: res.data.data.download._id,
            storageKey: cachedFile.storageKey,
            storedFileSize: cachedFile.storedFileSize || doc.fileSize || 0,
          })
        } catch {}
      }
      toast.success('Full PDF saved to NovelHub Downloads')
      setSelectedPdf(null)
      setActiveTopTab('downloads')
    } catch {
      toast.error('Download failed')
    }
  }

  const handleLike = async (id) => {
    try {
      await novelService.like(id)
      fetchDocuments(1, false)
    } catch {}
  }

  const sharePdf = async (doc) => {
    try {
      const res = await novelService.download(doc._id)
      const url = res.data.data.fileUrl
      await navigator.clipboard.writeText(`${doc.title} - ${url}`)
      toast.success('PDF link copied')
    } catch {
      toast.error('Unable to prepare share link')
    }
  }

  const selectGenre = (nextGenre) => {
    setGenre(nextGenre)
    setActiveTopTab('novels')
  }

  const renderCover = (doc, sizeClass = 'w-36') => {
    const [from, to] = getCoverColors(doc)
    const docGenre = genreByKey[getDocumentGenre(doc)] || PDF_GENRES[4]
    return (
      <button key={doc._id} onClick={() => setSelectedPdf(doc)} className={`${sizeClass} flex-shrink-0 text-left`}>
        <div
          className="relative flex aspect-[0.7] flex-col justify-between overflow-hidden rounded-xl border p-3"
          style={{ background: from, borderColor: 'var(--color-border)' }}
        >
          <div className="absolute inset-0 opacity-40" style={{ background: to }} />
          <RiFileTextLine className="relative text-3xl text-white/80" />
          <p className="relative text-center text-sm font-black text-white line-clamp-4">{doc.title}</p>
          <span className="relative self-start rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-black text-emerald-300">
            {docGenre.label}
          </span>
        </div>
        <p className="mt-2 text-sm font-black line-clamp-2" style={{ color: 'var(--color-text)' }}>{doc.title}</p>
      </button>
    )
  }

  const DocumentRail = ({ title, items, compact = false, onViewAll }) => {
    if (!items.length) return null
    return (
      <section className="mb-9">
        <SectionHeader title={title} onViewAll={onViewAll} />
        <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
          {items.map((doc) => renderCover(doc, compact ? 'w-28' : 'w-36'))}
        </div>
      </section>
    )
  }

  const renderNovelCatalog = () => {
    if (loading) {
      return (
        <div className="space-y-8">
          <div className="skeleton h-40 rounded-2xl" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[...Array(8)].map((_, index) => <div key={index} className="skeleton h-56 rounded-xl" />)}
          </div>
        </div>
      )
    }

    if (documents.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <RiBookOpenLine className="mb-4 text-5xl" style={{ color: 'var(--color-text-muted)' }} />
          <p className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>No documents found</p>
          <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>Upload PDFs by genre to build the NovelHub catalog.</p>
        </div>
      )
    }

    return (
      <>
        <DocumentRail title="History" items={recentDocuments} compact onViewAll={() => selectGenre('all')} />
        <DocumentRail title="Best Novels" items={bestDocuments} onViewAll={() => selectGenre('all')} />

        {rankedDocuments.length > 0 && (
          <section className="mb-9">
            <SectionHeader title="Ranking" onViewAll={() => selectGenre('all')} />
            <div className="no-scrollbar flex gap-4 overflow-x-auto pb-2">
              <div className="min-w-[320px] max-w-lg rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <p className="mb-4 text-lg font-black" style={{ color: 'var(--color-text)' }}>Must Read</p>
                <div className="space-y-4">
                  {rankedDocuments.slice(0, 3).map((doc, index) => {
                    const docGenre = genreByKey[getDocumentGenre(doc)] || PDF_GENRES[4]
                    return (
                      <button key={doc._id} onClick={() => setSelectedPdf(doc)} className="flex w-full items-center gap-4 text-left">
                        <span className="w-7 text-2xl font-black" style={{ color: index === 0 ? '#FACC15' : index === 1 ? '#FB923C' : '#EC4899' }}>
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-black" style={{ color: 'var(--color-text)' }}>{doc.title}</p>
                          <p className="mt-1 text-xs font-black text-emerald-400">{docGenre.label}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        <section className="mb-9">
          <SectionHeader title="Genres" onViewAll={() => selectGenre('all')} />
          <div className="no-scrollbar flex gap-3 overflow-x-auto pb-1">
            {[{ key: 'all', label: 'All' }, ...PDF_GENRES].map((item) => (
              <button
                key={item.key}
                onClick={() => selectGenre(item.key)}
                className="min-w-36 rounded-xl px-4 py-4 text-left text-sm font-black"
                style={{
                  background: genre === item.key ? 'var(--color-primary)' : 'var(--color-surface)',
                  color: genre === item.key ? '#fff' : 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {item.label}
              </button>
            ))}
          </div>
        </section>

        {categorySections.map((section) => (
          <DocumentRail key={section.key} title={section.label} items={section.items} onViewAll={() => selectGenre(section.key)} />
        ))}

        <section className="mb-9">
          <SectionHeader title="Featured For You" />
          <div className="space-y-4">
            {rankedDocuments.slice(6, 16).map((doc) => {
              const docGenre = genreByKey[getDocumentGenre(doc)] || PDF_GENRES[4]
              return (
                <button key={doc._id} onClick={() => setSelectedPdf(doc)} className="flex w-full gap-4 rounded-2xl p-3 text-left"
                  style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                  <div className="w-24 flex-shrink-0">{renderCover(doc, 'w-24')}</div>
                  <div className="min-w-0 pt-3">
                    <p className="text-xl font-black line-clamp-2" style={{ color: 'var(--color-text)' }}>{doc.title}</p>
                    <p className="mt-2 text-sm line-clamp-2" style={{ color: 'var(--color-text-muted)' }}>
                      {doc.description || doc.author || 'PDF document available in NovelHub.'}
                    </p>
                    <span className="mt-3 inline-block rounded-md bg-emerald-500/20 px-2 py-1 text-xs font-black text-emerald-300">
                      {docGenre.label}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </section>

        <div ref={loadMoreRef} className="flex items-center justify-center py-8">
          {loadingMore ? <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" /> : null}
        </div>
      </>
    )
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold gradient-text">NovelHub</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Read, upload, download and share PDF novels by genre.
            </p>
          </div>
          {activeTopTab === 'novels' && isAuthenticated && (
            <button onClick={() => setShowUpload(true)} className="btn-primary inline-flex items-center gap-2">
              <RiUploadLine /> Upload Document
            </button>
          )}
        </div>

        <div className="grid gap-2 rounded-2xl p-1 sm:grid-cols-3" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
          {TOP_TABS.map(({ key, label, icon: Icon }) => {
            const active = activeTopTab === key
            return (
              <button
                key={key}
                onClick={() => setActiveTopTab(key)}
                className="flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black"
                style={{
                  background: active ? 'var(--color-primary)' : 'transparent',
                  color: active ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                <Icon /> {label}
              </button>
            )
          })}
        </div>

        {activeTopTab === 'novels' && (
          <div className="flex flex-wrap gap-3">
            <div className="relative min-w-52 flex-1">
              <RiSearchLine className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-text-muted)' }} />
              <input
                type="text"
                placeholder="Search PDF novels, authors, genres..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="input-base pl-10 py-2.5"
              />
            </div>
            <select value={genre} onChange={(event) => setGenre(event.target.value)} className="input-base py-2.5" style={{ width: 'auto' }}>
              <option value="all">All Genres</option>
              {PDF_GENRES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
            </select>
          </div>
        )}
      </div>

      {activeTopTab === 'novels' && <GoogleAdSlot placement="novels" className="mb-6" />}

      {activeTopTab === 'downloads' ? (
        <DownloadsPage embedded contentType="document" />
      ) : activeTopTab === 'office' ? (
        <OfficeWorkspace />
      ) : (
        renderNovelCatalog()
      )}

      {selectedPdf && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
          style={{ background: 'rgba(0,0,0,0.72)', backdropFilter: 'blur(8px)' }}>
          <div className="max-h-[92vh] w-full max-w-3xl overflow-hidden rounded-t-3xl md:rounded-3xl"
            style={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)' }}>
            <div className="flex items-center gap-3 p-5" style={{ background: 'var(--color-bg-deep)', borderBottom: '1px solid var(--color-border)' }}>
              <div className="min-w-0 flex-1">
                <h2 className="truncate font-display text-xl font-black" style={{ color: 'var(--color-text)' }}>{selectedPdf.title}</h2>
                <p className="mt-1 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {(genreByKey[getDocumentGenre(selectedPdf)] || PDF_GENRES[4]).label} | Chapter One Preview
                </p>
              </div>
              <button onClick={() => sharePdf(selectedPdf)} className="rounded-xl p-3" style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}>
                <RiShareForwardLine />
              </button>
              <button onClick={() => setSelectedPdf(null)} className="rounded-xl p-3" style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}>
                <RiCloseLine />
              </button>
            </div>

            <div className="max-h-[76vh] overflow-y-auto p-5">
              <div className="rounded-2xl p-5" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <h3 className="mb-3 font-display text-2xl font-black" style={{ color: 'var(--color-text)' }}>Chapter One</h3>
                <p className="whitespace-pre-line text-sm leading-7" style={{ color: 'var(--color-text)' }}>
                  {selectedPdf.description || `${selectedPdf.title} begins here. Download the PDF to continue reading the complete document from chapter two onward.`}
                  {selectedPdf.author ? `\n\nAuthor: ${selectedPdf.author}` : ''}
                </p>
                {(selectedPdf.licenseType && selectedPdf.licenseType !== 'unknown') || selectedPdf.sourceName || selectedPdf.attributionText ? (
                  <div className="mt-5 rounded-xl p-4 text-left" style={{ background: 'var(--color-bg-deep)', border: '1px solid var(--color-border)' }}>
                    <p className="text-xs font-black uppercase tracking-wide" style={{ color: 'var(--color-text-muted)' }}>Rights</p>
                    <p className="mt-2 text-sm" style={{ color: 'var(--color-text)' }}>
                      {selectedPdf.attributionText || selectedPdf.sourceName || selectedPdf.licenseType}
                    </p>
                    {selectedPdf.sourceUrl ? (
                      <a href={selectedPdf.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                        View source
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-4 rounded-2xl p-6 text-center" style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
                <RiLockLine className="mx-auto mb-3 text-4xl" style={{ color: 'var(--color-primary)' }} />
                <h3 className="font-display text-xl font-black" style={{ color: 'var(--color-text)' }}>Chapter Two is locked</h3>
                <p className="mx-auto mt-2 max-w-lg text-sm leading-6" style={{ color: 'var(--color-text-muted)' }}>
                  Download this PDF to unlock full read-only access in the NovelHub Downloads tab. Downloaded PDFs can be opened offline.
                </p>
                <button onClick={() => handleDownload(selectedPdf)} className="btn-primary mt-5 inline-flex items-center gap-2">
                  <RiDownloadLine /> Download Full PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
          <div className="w-full max-w-md rounded-2xl p-6 animate-slide-up"
            style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-xl font-bold" style={{ color: 'var(--color-text)' }}>Upload PDF</h2>
              <button onClick={() => setShowUpload(false)} className="p-2" style={{ color: 'var(--color-text-muted)' }}>
                <RiCloseLine />
              </button>
            </div>
            <form onSubmit={handleUpload} className="space-y-3">
              <input type="text" placeholder="Title *" value={uploadForm.title}
                onChange={(event) => setUploadForm({ ...uploadForm, title: event.target.value })}
                className="input-base" required />
              <input type="text" placeholder="Author" value={uploadForm.author}
                onChange={(event) => setUploadForm({ ...uploadForm, author: event.target.value })}
                className="input-base" />
              <textarea placeholder="Description" value={uploadForm.description}
                onChange={(event) => setUploadForm({ ...uploadForm, description: event.target.value })}
                className="input-base resize-none" rows={3} />
              <select value={uploadForm.category}
                onChange={(event) => setUploadForm({ ...uploadForm, category: event.target.value })}
                className="input-base">
                {PDF_GENRES.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <input type="text" placeholder="Tags (comma separated)" value={uploadForm.tags}
                onChange={(event) => setUploadForm({ ...uploadForm, tags: event.target.value })}
                className="input-base" />
              <div className="rounded-xl p-4 space-y-3" style={{ background: 'var(--color-surface-high)', border: '1px solid var(--color-border)' }}>
                <div>
                  <p className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>Rights and source</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                    Record public domain, Creative Commons, or permission details for this PDF.
                  </p>
                </div>
                <select value={uploadForm.licenseType}
                  onChange={(event) => setUploadForm({ ...uploadForm, licenseType: event.target.value })}
                  className="input-base">
                  {LICENSE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </select>
                <input type="text" placeholder="Source name e.g. Project Gutenberg" value={uploadForm.sourceName}
                  onChange={(event) => setUploadForm({ ...uploadForm, sourceName: event.target.value })}
                  className="input-base" />
                <input type="url" placeholder="Source URL" value={uploadForm.sourceUrl}
                  onChange={(event) => setUploadForm({ ...uploadForm, sourceUrl: event.target.value })}
                  className="input-base" />
                <input type="url" placeholder="License URL" value={uploadForm.licenseUrl}
                  onChange={(event) => setUploadForm({ ...uploadForm, licenseUrl: event.target.value })}
                  className="input-base" />
                <textarea placeholder="Attribution text" value={uploadForm.attributionText}
                  onChange={(event) => setUploadForm({ ...uploadForm, attributionText: event.target.value })}
                  className="input-base resize-none" rows={2} />
                <textarea placeholder="Rights notes / proof summary" value={uploadForm.rightsSummary}
                  onChange={(event) => setUploadForm({ ...uploadForm, rightsSummary: event.target.value })}
                  className="input-base resize-none" rows={2} />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={uploadForm.requiresAttribution}
                    onChange={(event) => setUploadForm({ ...uploadForm, requiresAttribution: event.target.checked })}
                    className="w-4 h-4 rounded" />
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Show attribution for this PDF</span>
                </label>
              </div>
              <div className="cursor-pointer rounded-xl border-2 border-dashed p-4 text-center transition-colors"
                style={{ borderColor: 'var(--color-border)' }}
                onClick={() => document.getElementById('doc-file').click()}>
                <RiUploadLine className="mx-auto mb-2 text-2xl" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                  {uploadForm.file ? uploadForm.file.name : 'Click to select a PDF file'}
                </p>
                <input id="doc-file" type="file" className="hidden" accept=".pdf,application/pdf"
                  onChange={(event) => setUploadForm({ ...uploadForm, file: event.target.files[0] })} />
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowUpload(false)} className="btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={uploading} className="btn-primary flex-1">
                  {uploading ? 'Uploading...' : 'Upload'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

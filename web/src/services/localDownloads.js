const INDEX_KEY = 'nendplay:local-downloads:index'
const CACHE_NAME = 'nendplay-downloads-v1'

function readIndex() {
  try {
    return JSON.parse(localStorage.getItem(INDEX_KEY) || '[]')
  } catch {
    return []
  }
}

function writeIndex(items) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(items))
}

function cacheKey(storageKey) {
  return storageKey?.startsWith('/') ? new Request(storageKey) : storageKey
}

function snapshotFrom(download = {}, fallback = {}) {
  const snap = download.contentSnapshot || {}
  return {
    title: fallback.title || snap.title || 'Downloaded file',
    thumbnailUrl: fallback.thumbnailUrl || snap.thumbnailUrl || '',
    type: fallback.type || snap.type || (download.contentType === 'document' ? 'pdf' : 'video'),
    category: fallback.category || snap.category || '',
    duration: fallback.duration || snap.duration || 0,
    fileSize: fallback.fileSize || snap.fileSize || 0,
    mimeType: fallback.mimeType || snap.mimeType || '',
    fileUrl: fallback.fileUrl || snap.fileUrl || '',
  }
}

export async function cacheDownloadFile({ fileUrl, contentType, contentId }) {
  if (!fileUrl) throw new Error('No file URL available for this download.')
  const storageKey = `/__nendplay_downloads__/${encodeURIComponent(contentType)}-${encodeURIComponent(contentId)}`
  if (!('caches' in window)) return { storageKey, storedFileSize: 0, cached: false }

  const response = await fetch(fileUrl, { mode: 'cors' })
  if (!response.ok) throw new Error(`Download failed with status ${response.status}`)
  const clone = response.clone()
  const blob = await response.blob()
  const cache = await caches.open(CACHE_NAME)
  await cache.put(new Request(storageKey), clone)
  return { storageKey, storedFileSize: blob.size || 0, cached: true }
}

export function upsertLocalDownloadRecord({ download, contentType, contentId, storageKey, storedFileSize, snapshot = {} }) {
  if (!storageKey) return null
  const resolvedContentType = contentType || download?.contentType || 'media'
  const resolvedContentId = String(contentId || download?.contentId || download?._id || storageKey)
  const record = {
    _id: download?._id || `local-${resolvedContentType}-${resolvedContentId}`,
    localOnly: !download?._id,
    contentType: resolvedContentType,
    contentId: resolvedContentId,
    status: 'completed',
    storageKey,
    storedFileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || 0,
    downloadedAt: download?.downloadedAt || new Date().toISOString(),
    contentSnapshot: snapshotFrom(download, {
      ...snapshot,
      fileSize: storedFileSize || snapshot.fileSize || download?.storedFileSize || 0,
    }),
  }
  const next = [
    record,
    ...readIndex().filter((item) => {
      const sameFile = item.storageKey === record.storageKey
      const sameContent = item.contentType === record.contentType && String(item.contentId) === String(record.contentId)
      return !sameFile && !sameContent
    }),
  ]
  writeIndex(next)
  return record
}

export async function getLocalDownloads({ contentType } = {}) {
  const items = readIndex()
  if (!('caches' in window)) {
    return items.filter((item) => !contentType || item.contentType === contentType)
  }
  const cache = await caches.open(CACHE_NAME)
  const valid = []
  const validKeys = new Set()
  for (const item of items) {
    const match = await cache.match(cacheKey(item.storageKey))
    if (!match) continue
    validKeys.add(item.storageKey)
    if (contentType && item.contentType !== contentType) continue
    valid.push({ ...item, localOnly: true })
  }
  if (validKeys.size !== items.length) {
    writeIndex(items.filter((item) => validKeys.has(item.storageKey)))
  }
  return valid
}

export async function getCachedObjectUrl(storageKey) {
  if (!storageKey || !('caches' in window)) return ''
  const cache = await caches.open(CACHE_NAME)
  const response = await cache.match(cacheKey(storageKey))
  if (!response) return ''
  const blob = await response.blob()
  return URL.createObjectURL(blob)
}

export async function deleteLocalDownload(storageKey) {
  if (storageKey && 'caches' in window) {
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(cacheKey(storageKey))
  }
  writeIndex(readIndex().filter((item) => item.storageKey !== storageKey && item._id !== storageKey))
}

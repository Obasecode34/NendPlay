const STORAGE_KEY = 'nendplay_watch_history'
const MAX_ITEMS = 200

function readItems() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeItems(items) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)))
  } catch {}
}

export function getWatchHistory() {
  return readItems()
}

export function addWatchHistory(media, progress = {}) {
  if (!media?._id) return

  const item = {
    _id: media._id,
    title: media.title || 'Untitled',
    type: media.type || 'media',
    thumbnailUrl: media.thumbnailUrl || media.thumbnail || media.posterUrl || '',
    duration: Number(progress.duration || media.duration || 0),
    completed: true,
    watchedAt: new Date().toISOString(),
  }

  writeItems([item, ...readItems().filter((entry) => entry._id !== media._id)])
}

export function clearWatchHistoryByDays(days) {
  if (days === 'all') {
    writeItems([])
    return []
  }

  const numberOfDays = Number(days)
  if (!Number.isFinite(numberOfDays) || numberOfDays <= 0) {
    return readItems()
  }

  const cutoff = Date.now() - numberOfDays * 24 * 60 * 60 * 1000
  const remaining = readItems().filter((entry) => {
    const watchedAt = new Date(entry.watchedAt || entry.updatedAt || 0).getTime()
    return !watchedAt || watchedAt < cutoff
  })
  writeItems(remaining)
  return remaining
}

const STORAGE_KEY = 'nendplay_continue_watching'
const MAX_ITEMS = 40

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

export function getContinueWatching() {
  return readItems()
}

export function upsertContinueWatching(media, progress = {}) {
  if (!media?._id) return
  const played = Number(progress.played || 0)
  if (played >= 0.95) {
    removeContinueWatching(media._id)
    return
  }

  const item = {
    _id: media._id,
    title: media.title || 'Untitled',
    type: media.type || 'media',
    thumbnailUrl: media.thumbnailUrl || media.thumbnail || media.posterUrl || '',
    progress: Math.max(0, Math.min(played, 0.94)),
    playedSeconds: Number(progress.playedSeconds || 0),
    duration: Number(progress.duration || media.duration || 0),
    updatedAt: new Date().toISOString(),
  }

  writeItems([item, ...readItems().filter((entry) => entry._id !== media._id)])
}

export function removeContinueWatching(mediaId) {
  if (!mediaId) return
  writeItems(readItems().filter((entry) => entry._id !== mediaId))
}

const GUEST_ID_KEY = 'nendplay-guest-id'
const DEVICE_ID_KEY = 'nendplay-device-id'

function createId(prefix) {
  const randomPart = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${randomPart}`
}

function getStoredId(key, prefix) {
  if (typeof window === 'undefined') return createId(prefix)
  const existing = localStorage.getItem(key)
  if (existing) return existing
  const next = createId(prefix)
  localStorage.setItem(key, next)
  return next
}

export function getGuestId() {
  return getStoredId(GUEST_ID_KEY, 'guest')
}

export function getDeviceId() {
  return getStoredId(DEVICE_ID_KEY, 'device')
}

export function getGuestSession() {
  return {
    guestId: getGuestId(),
    deviceId: getDeviceId(),
  }
}

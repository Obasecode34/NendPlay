// src/services/media.service.js
import api from './api'

export const mediaService = {
  getAll: (params) => api.get('/media', { params }),
  getById: (id) => api.get(`/media/${id}`),
  getPlayback: (id) => api.get(`/media/${id}/playback`),
  upload: (formData) => api.post('/media/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  createUploadSession: (data) => api.post('/media/upload-session', data),
  completeExternalUpload: (data) => api.post('/media/external', data),
  update: (id, data) => api.patch(`/media/${id}`, data),
  delete: (id) => api.delete(`/media/${id}`),
  like: (id) => api.post(`/media/${id}/like`),
  dislike: (id) => api.post(`/media/${id}/dislike`),
  comment: (id, data) => api.post(`/media/${id}/comment`, data),
  save: (id) => api.post(`/media/${id}/save`),
  subscribeCreator: (creatorId) => api.post(`/media/creators/${creatorId}/subscribe`),
  remix: (id, data) => api.post(`/media/${id}/remix`, data),
  syncBunny: (id) => api.post(`/media/${id}/sync-bunny`),
  syncMux: (id) => api.post(`/media/${id}/sync-mux`),
  getSaved: (params) => api.get('/media/saved', { params }),
  getShorts: (params) => api.get('/media/shorts', { params }),
  getSubscribedShorts: (params) => api.get('/media/shorts/subscribed', { params }),
  getLiveEvents: (params) => api.get('/media/live', { params }),
  getByUser: (userId, params) => api.get(`/media/user/${userId}`, { params }),
  getStreamUrl: (id) => `/api/media/${id}/stream`,
  resolveStreamUrl: (url) => {
    if (!url) return ''
    if (/^https?:\/\//i.test(url)) return url
    const base = api.defaults.baseURL?.replace(/\/api\/?$/, '') || ''
    return `${base}${url}`
  },
}

// src/services/subscription.service.js
export const subscriptionService = {
  getPlans: () => api.get('/subs/plans'),
  initialize: (data) => api.post('/subs/initialize', data),
  verify: (data) => api.post('/subs/verify', data),
  cancel: (data) => api.post('/subs/cancel', data),
  getMySubscription: () => api.get('/subs/me'),
  getHistory: () => api.get('/subs/history'),
  startSession: (data) => api.post('/subs/session/start', data),
  endSession: (data) => api.post('/subs/session/end', data),
  pingSession: (data) => api.post('/subs/session/ping', data),
}

// src/services/ad.service.js
export const adService = {
  getPricing: (params) => api.get('/ads/pricing', { params }),
  submit: (data) => api.post('/ads/submit', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  verify: (data) => api.post('/ads/verify', data),
  serve: (params) => api.get('/ads/serve', { params }),
  getMyAds: (params) => api.get('/ads/my', { params }),
  getById: (id) => api.get(`/ads/${id}`),
  getAnalytics: (id) => api.get(`/ads/${id}/analytics`),
  toggle: (id) => api.patch(`/ads/${id}/toggle`),
  recordImpression: (id) => api.post(`/ads/${id}/impression`),
  recordClick: (id) => api.post(`/ads/${id}/click`),
}

// src/services/download.service.js
export const downloadService = {
  authorize: (data) => api.post('/downloads/authorize', data),
  complete: (data) => api.post('/downloads/complete', data),
  getAll: (params) => api.get('/downloads', { params }),
  getDevices: () => api.get('/downloads/devices'),
  check: (params) => api.get('/downloads/check', { params }),
  delete: (id) => api.delete(`/downloads/${id}`),
  deleteDevice: (deviceId) => api.delete(`/downloads/device/${deviceId}`),
}

// src/services/novel.service.js
export const novelService = {
  getGenres: () => api.get('/novels/genres'),
  getAll: (params) => api.get('/novels', { params }),
  getById: (id) => api.get(`/novels/${id}`),
  upload: (formData) => api.post('/novels/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  update: (id, data) => api.patch(`/novels/${id}`, data),
  delete: (id) => api.delete(`/novels/${id}`),
  fork: (id) => api.post(`/novels/${id}/fork`),
  download: (id) => api.get(`/novels/${id}/download`),
  like: (id) => api.post(`/novels/${id}/like`),
  getForks: (id, params) => api.get(`/novels/${id}/forks`, { params }),
  getByUser: (userId, params) => api.get(`/novels/user/${userId}`, { params }),
}

// src/services/referral.service.js
export const referralService = {
  getTiers: () => api.get('/referrals/tiers'),
  getDashboard: () => api.get('/referrals/dashboard'),
  getLink: () => api.get('/referrals/link'),
  checkReward: () => api.post('/referrals/check-reward'),
}

// src/services/reward.service.js
export const rewardService = {
  getStatus: () => api.get('/rewards/status'),
  earnFromAd: (data) => api.post('/rewards/ad-earned', data),
  redeem: (data) => api.post('/rewards/redeem', data),
  initializePaidAdFree: (data) => api.post('/rewards/ad-free/initialize', data),
  verifyPaidAdFree: (data) => api.post('/rewards/ad-free/verify', data),
}

export const newsService = {
  getDailyNews: (params) => api.get('/news', { params }),
  getPost: (id) => api.get(`/news/${id}`),
  like: (id) => api.post(`/news/${id}/like`),
  comment: (id, data) => api.post(`/news/${id}/comments`, data),
  reply: (id, commentId, data) => api.post(`/news/${id}/comments/${commentId}/replies`, data),
  likeComment: (id, commentId) => api.post(`/news/${id}/comments/${commentId}/like`),
  share: (id) => api.post(`/news/${id}/share`),
}

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getAnalyticsSummary: () => api.get('/analytics/admin/summary'),
  getPermissions: () => api.get('/admin/permissions'),
  getUsers: (params) => api.get('/admin/users', { params }),
  getUserDetails: (id) => api.get(`/admin/users/${id}`),
  updateUser: (id, data) => api.patch(`/admin/users/${id}`, data),
  sendUserEmail: (id, data) => api.post(`/admin/users/${id}/email`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getMedia: (params) => api.get('/admin/media', { params }),
  syncBunnyMedia: (data) => api.post('/admin/media/sync/bunny', data),
  updateMedia: (id, data) => api.patch(`/admin/media/${id}`, data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  approveMedia: (id) => api.post(`/admin/media/${id}/approve`),
  rejectMedia: (id, data) => api.post(`/admin/media/${id}/reject`, data),
  deleteMedia: (id) => api.delete(`/admin/media/${id}`),
  getDocuments: (params) => api.get('/admin/documents', { params }),
  importDocument: (data) => api.post('/admin/documents/import', data),
  updateDocument: (id, data) => api.patch(`/admin/documents/${id}`, data),
  approveDocument: (id, data) => api.post(`/admin/documents/${id}/approve`, data),
  rejectDocument: (id, data) => api.post(`/admin/documents/${id}/reject`, data),
  deleteDocument: (id) => api.delete(`/admin/documents/${id}`),
  getAds: (params) => api.get('/admin/ads', { params }),
  createAd: (data) => api.post('/admin/ads', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  updateAd: (id, data) => api.patch(`/admin/ads/${id}`, data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  deleteAd: (id) => api.delete(`/admin/ads/${id}`),
  getSubscriptions: (params) => api.get('/admin/subscriptions', { params }),
  getDownloads: (params) => api.get('/admin/downloads', { params }),
  getRewards: (params) => api.get('/admin/rewards', { params }),
  getNewsPosts: (params) => api.get('/admin/news', { params }),
  createNewsPost: (data) => api.post('/admin/news', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  updateNewsPost: (id, data) => api.patch(`/admin/news/${id}`, data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  deleteNewsPost: (id) => api.delete(`/admin/news/${id}`),
  getPushStats: () => api.get('/notifications/admin/stats'),
  getInAppNotifications: (params) => api.get('/notifications/admin/in-app', { params }),
  deleteInAppNotification: (id) => api.delete(`/notifications/admin/in-app/${id}`),
  sendPushNotification: (data) => api.post('/notifications/admin/send', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
  sendInAppNotification: (data) => api.post('/notifications/admin/in-app', data, data instanceof FormData
    ? { headers: { 'Content-Type': 'multipart/form-data' } }
    : undefined),
}

export const notificationService = {
  getMine: (params) => api.get('/notifications/me', { params }),
  getPublicPopups: (params) => api.get('/notifications/public/popups', { params }),
  markRead: (id) => api.patch(`/notifications/me/${id}/read`),
  markAllRead: () => api.patch('/notifications/me/read-all'),
}

export const analyticsService = {
  track: (data) => api.post('/analytics/track', data),
}

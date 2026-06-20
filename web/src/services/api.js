// src/services/api.js
// Axios instance with automatic token refresh on 401.
// All API calls go through this instance.

import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true, // sends cookies with every request
  headers: {
    'Content-Type': 'application/json',
    'x-client-platform': 'web',
  },
})

// ── Response interceptor: auto-refresh on 401 ─────────────────────────────
let isRefreshing = false
let failedQueue = []

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes('/auth/refresh-token') &&
      !originalRequest.url.includes('/auth/login')
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const res = await api.post('/auth/refresh-token')
        const { accessToken } = res.data.data

        api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`

        // Update auth store token
        const { default: useAuthStore } = await import('../stores/authStore')
        useAuthStore.getState().setAccessToken(accessToken)

        processQueue(null, accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)

        // Refresh failed — log out
        const { default: useAuthStore } = await import('../stores/authStore')
        useAuthStore.getState().clearAuth()

        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

export default api

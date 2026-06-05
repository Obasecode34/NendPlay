// src/stores/authStore.js
// Manages authentication state.
// Access token is stored in memory (never localStorage — XSS protection).
// Refresh token lives in HttpOnly cookie (handled by the browser automatically).

import { create } from 'zustand'
import api from '../services/api'

const useAuthStore = create((set, get) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isLoading: true, // true on startup while checking auth

  // ── Set tokens and user after login/register ──────────────────────────
  setAuth: (user, accessToken) => {
    set({ user, accessToken, isAuthenticated: true, isLoading: false })
    // Inject token into axios defaults
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  },

  // ── Update user profile ───────────────────────────────────────────────
  updateUser: (updatedUser) => {
    set((state) => ({
      user: { ...state.user, ...updatedUser },
    }))
  },

  // ── Update access token (after refresh) ──────────────────────────────
  setAccessToken: (accessToken) => {
    set({ accessToken })
    api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`
  },

  // ── Clear auth state on logout ────────────────────────────────────────
  clearAuth: () => {
    set({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
    delete api.defaults.headers.common['Authorization']
  },

  // ── Initialize: check if we have a valid session on app load ─────────
  // Tries to refresh the access token using the HttpOnly cookie
 initAuth: async () => {
  try {
    const res = await api.post('/auth/refresh-token')
    if (res.data.success) {
      const { user, accessToken } = res.data.data
      get().setAuth(user, accessToken)
    } else {
      set({ isLoading: false })
    }
  } catch {
    // No active session — show landing page
    set({ isLoading: false })
  }
},

  // ── Logout ────────────────────────────────────────────────────────────
  logout: async () => {
    try {
      await api.post('/auth/logout')
    } catch {}
    get().clearAuth()
  },
}))

export default useAuthStore

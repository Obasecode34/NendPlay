// src/services/auth.service.js
import api from './api'

export const authService = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  google: (data) => api.post('/auth/google', data),
  forgotPassword: (data) => api.post('/auth/forgot-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),
  logout: () => api.post('/auth/logout'),
  refreshToken: (data) => api.post('/auth/refresh-token', data),
  getMe: () => api.get('/auth/me'),
  updateProfile: (data) => api.patch('/auth/update-profile', data),
  updateProfilePicture: (formData) => api.patch('/auth/profile-picture', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  updateEmail: (data) => api.patch('/auth/update-email', data),
  updateUsername: (data) => api.patch('/auth/update-username', data),
  changePassword: (data) => api.patch('/auth/change-password', data),
}

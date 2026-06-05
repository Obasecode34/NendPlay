import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RiEditLine, RiUploadLine, RiLogoutBoxRLine, RiShieldLine,
  RiVipCrownLine, RiGiftLine, RiAddLine, RiLoginBoxLine, RiUserAddLine, RiCameraLine } from 'react-icons/ri'
import { useInView } from 'react-intersection-observer'
import toast from 'react-hot-toast'
import useAuthStore from '../stores/authStore'
import { authService } from '../services/auth.service'
import { mediaService, subscriptionService } from '../services/index'
import MediaCard from '../components/media/MediaCard'
import UploadModal from '../components/media/UploadModal'

const PROFILE_PAGE_LIMIT = 20

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, isAuthenticated, logout, updateUser } = useAuthStore()
  const fileInputRef = useRef(null)
  const [myMedia, setMyMedia] = useState([])
  const [uploadsPage, setUploadsPage] = useState(1)
  const [uploadsHasMore, setUploadsHasMore] = useState(false)
  const [uploadsLoadingMore, setUploadsLoadingMore] = useState(false)
  const [savedMedia, setSavedMedia] = useState([])
  const [savedLoading, setSavedLoading] = useState(true)
  const [savedPage, setSavedPage] = useState(1)
  const [savedHasMore, setSavedHasMore] = useState(false)
  const [savedLoadingMore, setSavedLoadingMore] = useState(false)
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(false)
  const [showUpload, setShowUpload] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [activeTab, setActiveTab] = useState('uploads')
  const [profileForm, setProfileForm] = useState({
    profileName: user?.profileName || '',
    email: user?.email || '',
    username: user?.username || '',
  })
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '', newPassword: '',
  })
  const { ref: loadMoreRef, inView: loadMoreInView } = useInView({ rootMargin: '320px' })

  useEffect(() => {
    if (isAuthenticated) fetchData()
    else setLoading(false)
  }, [isAuthenticated])

  useEffect(() => {
    setProfileForm({
      profileName: user?.profileName || '',
      email: user?.email || '',
      username: user?.username || '',
    })
  }, [user?.profileName, user?.email, user?.username])

  useEffect(() => {
    if (activeTab === 'saved' && isAuthenticated) {
      fetchSavedMedia(1, false)
    }
  }, [activeTab, isAuthenticated])

  useEffect(() => {
    if (!loadMoreInView) return
    if (!isAuthenticated) return
    if (activeTab === 'uploads') loadMoreUploads()
    if (activeTab === 'saved') loadMoreSaved()
  }, [loadMoreInView, activeTab, uploadsHasMore, savedHasMore, uploadsPage, savedPage])

  const fetchData = async () => {
    if (!isAuthenticated) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [mediaRes, subRes] = await Promise.all([
        mediaService.getByUser(user?._id || user?.id, { page: 1, limit: PROFILE_PAGE_LIMIT }),
        subscriptionService.getMySubscription(),
      ])
      const pagination = mediaRes.data.data.pagination || {}
      setMyMedia(mediaRes.data.data.media || [])
      setUploadsPage(1)
      setUploadsHasMore(1 < (pagination.pages || 1))
      setSubscription(subRes.data.data)
    } catch {}
    finally { setLoading(false) }
  }

  const fetchUploads = async (pageToLoad = 1, append = false) => {
    if (!isAuthenticated) return
    if (append) setUploadsLoadingMore(true)
    else setLoading(true)
    try {
      const res = await mediaService.getByUser(user?._id || user?.id, {
        page: pageToLoad,
        limit: PROFILE_PAGE_LIMIT,
      })
      const nextMedia = res.data.data.media || []
      const pagination = res.data.data.pagination || {}
      setMyMedia((current) => append ? [...current, ...nextMedia] : nextMedia)
      setUploadsPage(pageToLoad)
      setUploadsHasMore(pageToLoad < (pagination.pages || 1))
    } catch {}
    finally { setLoading(false); setUploadsLoadingMore(false) }
  }

  const fetchSavedMedia = async (pageToLoad = 1, append = false) => {
    if (!isAuthenticated) return
    if (append) setSavedLoadingMore(true)
    else setSavedLoading(true)
    try {
      const res = await mediaService.getSaved({ page: pageToLoad, limit: PROFILE_PAGE_LIMIT })
      const nextMedia = res.data.data.media || []
      const pagination = res.data.data.pagination || {}
      setSavedMedia((current) => append ? [...current, ...nextMedia] : nextMedia)
      setSavedPage(pageToLoad)
      setSavedHasMore(pageToLoad < (pagination.pages || 1))
    } catch {} finally {
      setSavedLoading(false)
      setSavedLoadingMore(false)
    }
  }

  const loadMoreUploads = () => {
    if (loading || uploadsLoadingMore || !uploadsHasMore) return
    fetchUploads(uploadsPage + 1, true)
  }

  const loadMoreSaved = () => {
    if (savedLoading || savedLoadingMore || !savedHasMore) return
    fetchSavedMedia(savedPage + 1, true)
  }

  const handleSaveProfile = async () => {
    if (!profileForm.profileName.trim() && !profileForm.username.trim()) {
      toast.error('Enter a profile name or username')
      return
    }

    const payload = {
      profileName: profileForm.profileName.trim(),
    }
    if (profileForm.email.trim()) payload.email = profileForm.email.trim()
    if (profileForm.username.trim()) payload.username = profileForm.username.trim()

    setSaving(true)
    try {
      const res = await authService.updateProfile(payload)
      updateUser(res.data.data.user)
      toast.success('Profile updated!')
      setEditMode(false)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Update failed')
    } finally { setSaving(false) }
  }

  const handleProfilePictureUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file')
      event.target.value = ''
      return
    }

    const formData = new FormData()
    formData.append('profilePic', file)

    setAvatarUploading(true)
    try {
      const res = await authService.updateProfilePicture(formData)
      updateUser(res.data.data.user)
      toast.success('Profile picture updated!')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Profile picture update failed')
    } finally {
      setAvatarUploading(false)
      event.target.value = ''
    }
  }

  const handleChangePassword = async () => {
    if (user?.authMethod === 'credentials' && !passwordForm.currentPassword) {
      toast.error('Please enter your current password')
      return
    }
    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters')
      return
    }
    setSaving(true)
    try {
      await authService.changePassword(passwordForm)
      toast.success('Password changed! Please login again.')
      setPasswordForm({ currentPassword: '', newPassword: '' })
      await logout()
      navigate('/login')
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to change password')
    } finally { setSaving(false) }
  }

  const handleLogout = async () => {
    await logout()
    navigate('/home')
  }

  const planColors = {
    none: 'var(--color-text-muted)',
    mobile: '#60A5FA',
    basic: '#34D399',
    standard: '#A78BFA',
    premium: '#FBBF24',
  }

  const planIcons = { none: null, mobile: '📱', basic: '💻', standard: '⭐', premium: '👑' }

  if (!isAuthenticated) {
    return (
      <div className="animate-fade-in max-w-4xl">
        <div className="card p-6 mb-6">
          <div className="flex items-start gap-5">
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center flex-shrink-0 font-display font-black text-3xl text-white"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', boxShadow: '0 8px 30px var(--glow-color)' }}>
              G
            </div>
            <div className="flex-1">
              <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
                Guest Profile
              </h1>
              <p className="text-sm mt-2 max-w-xl" style={{ color: 'var(--color-text-muted)' }}>
                Browse, watch, read, and download without an account. Create an account only when you want to subscribe to a package.
              </p>
            </div>
            <button onClick={() => navigate('/subscribe')} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
              <RiVipCrownLine /> Subscribe
            </button>
          </div>
        </div>

        <div className="card p-6 space-y-3">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text)' }}>Account</h2>
          <button onClick={() => navigate('/login')} className="btn-primary w-full flex items-center justify-center gap-2">
            <RiLoginBoxLine /> Sign In
          </button>
          <button onClick={() => navigate('/register')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-colors"
            style={{ background: 'var(--color-surface-high)', color: 'var(--color-text)' }}>
            <RiUserAddLine /> Create Account
          </button>
        </div>

        <div className="card p-6 space-y-4 mt-6">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text)' }}>About NendPlay</h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            NendPlay is a media streaming platform offering movies, videos, music, TV shows, podcasts, live events and more.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="animate-fade-in max-w-4xl">
      {/* Profile header */}
      <div className="card p-6 mb-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden font-display font-black text-3xl text-white transition-transform hover:scale-[1.02] disabled:opacity-70"
              style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', boxShadow: '0 8px 30px var(--glow-color)' }}
              aria-label="Change profile picture">
              {user?.profilePic ? (
                <img src={user.profilePic} alt="" className="h-full w-full object-cover" />
              ) : (
                user?.profileName?.[0]?.toUpperCase() || user?.username?.[0]?.toUpperCase() || 'U'
              )}
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full text-sm shadow-lg disabled:opacity-70"
              style={{ background: 'var(--color-surface-high)', color: 'var(--color-primary)', border: '2px solid var(--color-surface)' }}
              aria-label="Upload profile picture">
              {avatarUploading ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              ) : (
                <RiCameraLine />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleProfilePictureUpload}
            />
          </div>

          <div className="flex-1 min-w-0">
            {editMode ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={profileForm.profileName}
                  onChange={(e) => setProfileForm({ ...profileForm, profileName: e.target.value })}
                  className="input-base text-lg font-bold"
                  placeholder="Display name"
                />
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className="input-base"
                  placeholder="Email address"
                />
                <input
                  type="text"
                  value={profileForm.username}
                  onChange={(e) => setProfileForm({ ...profileForm, username: e.target.value })}
                  className="input-base"
                  placeholder="Username"
                />
                <div className="flex gap-2">
                  <button onClick={handleSaveProfile} disabled={saving} className="btn-primary py-2 px-4 text-sm">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditMode(false)} className="btn-ghost py-2 px-4 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3">
                  <h1 className="font-display font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
                    {user?.profileName || user?.username || 'User'}
                  </h1>
                  <button onClick={() => setEditMode(true)}
                    className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                    style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
                    <RiEditLine className="text-sm" />
                  </button>
                </div>
                {user?.username && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    @{user.username}
                  </p>
                )}
                {user?.email && (
                  <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                    {user.email}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Subscription badge */}
          <div className="flex-shrink-0">
            {subscription?.isActive ? (
              <div className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ background: 'var(--color-surface-high)', color: planColors[subscription.plan] }}>
                {planIcons[subscription.plan]} {subscription.plan?.charAt(0).toUpperCase() + subscription.plan?.slice(1)}
              </div>
            ) : (
              <button onClick={() => navigate('/subscribe')}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
                <RiVipCrownLine /> Subscribe
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subscription info */}
      {subscription?.isActive && (
        <div className="card p-4 mb-6"
          style={{ borderColor: planColors[subscription.plan], borderWidth: '1px' }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
                {planIcons[subscription.plan]} {subscription.plan?.charAt(0).toUpperCase() + subscription.plan?.slice(1)} Plan
              </p>
              {subscription.expiryDate && (
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Expires: {new Date(subscription.expiryDate).toLocaleDateString()}
                </p>
              )}
            </div>
            <button onClick={() => navigate('/subscribe')}
              className="text-sm px-3 py-1.5 rounded-xl transition-colors"
              style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
              Manage
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {[
          { id: 'uploads', label: 'My Uploads' },
          { id: 'saved', label: 'Saved' },
          { id: 'security', label: 'Security' },
          { id: 'about', label: 'About' },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-all"
            style={{
              background: activeTab === id ? 'var(--color-primary)' : 'var(--color-surface)',
              color: activeTab === id ? 'white' : 'var(--color-text-muted)',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'uploads' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {myMedia.length} upload{myMedia.length !== 1 ? 's' : ''}
            </p>
            <button onClick={() => setShowUpload(true)} className="btn-primary py-2 px-4 text-sm flex items-center gap-2">
              <RiAddLine /> Upload Media
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton rounded-xl h-32" />)}
            </div>
          ) : myMedia.length === 0 ? (
            <div className="text-center py-12">
              <RiUploadLine className="text-4xl mx-auto mb-3" style={{ color: 'var(--color-text-muted)' }} />
              <p style={{ color: 'var(--color-text-muted)' }}>No uploads yet</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {myMedia.map((m) => <MediaCard key={m._id} media={m} size="md" />)}
            </div>
          )}
          <div ref={activeTab === 'uploads' ? loadMoreRef : null} className="flex items-center justify-center py-8">
            {uploadsLoadingMore && (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            )}
          </div>
        </div>
      )}

      {activeTab === 'saved' && (
        <div>
          <div className="mb-4">
            <p className="font-semibold" style={{ color: 'var(--color-text)' }}>
              {savedMedia.length} saved item{savedMedia.length !== 1 ? 's' : ''}
            </p>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Your saved Shorts and media are stored here for quick access.
            </p>
          </div>

          {savedLoading ? (
            <div className="grid grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton rounded-xl h-32" />)}
            </div>
          ) : savedMedia.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-xl mb-2" style={{ color: 'var(--color-text-muted)' }}>No saved media yet</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Save your favorite Shorts to access them anytime.</p>
            </div>
          ) : (
            <div className="flex flex-wrap gap-4">
              {savedMedia.map((m) => <MediaCard key={m._id} media={m} size="md" />)}
            </div>
          )}
          <div ref={activeTab === 'saved' ? loadMoreRef : null} className="flex items-center justify-center py-8">
            {savedLoadingMore && (
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            )}
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text)' }}>
            {user?.authMethod === 'google' ? 'Add Password' : 'Change Password'}
          </h2>
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            {user?.authMethod === 'google'
              ? 'Add a password so you can sign in with either email or username and password.'
              : 'Update your account password.'}
          </p>
          <>
              {user?.authMethod === 'credentials' && (
              <input type="password" placeholder="Current password"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="input-base" />
              )}
              <input type="password" placeholder="New password (min. 6 chars)"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="input-base" />
              <button onClick={handleChangePassword} disabled={saving} className="btn-primary w-full">
                {saving ? 'Saving...' : user?.authMethod === 'google' ? 'Add Password' : 'Change Password'}
              </button>
          </>

          <div className="pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
            <button onClick={handleLogout}
              className="flex items-center gap-2 text-sm font-medium transition-colors"
              style={{ color: '#EF4444' }}>
              <RiLogoutBoxRLine /> Logout of all devices
            </button>
          </div>
        </div>
      )}

      {activeTab === 'about' && (
        <div className="card p-6 space-y-4">
          <h2 className="font-display font-bold text-lg" style={{ color: 'var(--color-text)' }}>About NendPlay</h2>
          <div className="space-y-3 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            <p>NendPlay is a media streaming platform offering unlimited movies, videos, music, TV shows, podcasts, live events and more.</p>
            <div className="pt-2 space-y-2">
              {[
                { label: 'Version', value: '1.0.0' },
                { label: 'Platform', value: 'Web' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span>{label}</span>
                  <span style={{ color: 'var(--color-text)' }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-4 space-y-2" style={{ borderTop: '1px solid var(--color-border)' }}>
            {['How to Use', 'Privacy Policy', 'Terms of Service', 'Contact Support'].map((item) => (
              <button key={item}
                className="w-full text-left px-4 py-3 rounded-xl text-sm transition-colors"
                style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Upload modal */}
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} onSuccess={() => { fetchData(); setShowUpload(false) }} />}
    </div>
  )
}

import React, { useState } from 'react'
import { RiUploadLine, RiCloseFill, RiVideoLine, RiMusicLine } from 'react-icons/ri'
import toast from 'react-hot-toast'
import * as tus from 'tus-js-client'
import { mediaService } from '../../services/index'

const MEDIA_TYPES = [
  { value: 'movie', label: '🎬 Movie' },
  { value: 'video', label: '🎥 Video' },
  { value: 'music', label: '🎵 Music' },
  { value: 'tv_show', label: '📺 TV Show' },
  { value: 'comedy', label: '😂 Comedy' },
  { value: 'talk_show', label: '🎙 Talk Show' },
  { value: 'podcast', label: '🎧 Podcast' },
  { value: 'short', label: '⚡ Short (max 3min)' },
  { value: 'live_event', label: '🔴 Live Event' },
]

export default function UploadModal({ onClose, onSuccess }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [form, setForm] = useState({
    title: '', description: '', type: 'video',
    category: 'general', tags: '', artist: '',
    genre: '', language: '', country: '', contentRating: '',
    releaseStatus: 'released', publishStatus: 'published',
    homeSections: '', availabilityCountries: '',
    releaseYear: '', isLocked: false, isShort: false,
    isLive: false, isFeatured: false, featuredRank: '',
    uploadProvider: 'bunny',
  })
  const [mediaFile, setMediaFile] = useState(null)
  const [thumbnailFile, setThumbnailFile] = useState(null)

  const getMetadataPayload = () => Object.fromEntries(
    Object.entries(form)
      .filter(([key]) => key !== 'uploadProvider')
      .map(([key, value]) => [key, value?.toString?.() ?? value])
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!mediaFile || !form.title) {
      toast.error('Please provide a title and media file')
      return
    }
    setUploading(true)
    setProgress(0)
    try {
      if (form.uploadProvider === 'bunny') {
        const sessionRes = await mediaService.createUploadSession({
          provider: 'bunny',
          title: form.title,
          type: form.type,
          mimeType: mediaFile.type,
        })
        const session = sessionRes.data.data.session

        await new Promise((resolve, reject) => {
          const upload = new tus.Upload(mediaFile, {
            endpoint: session.directUpload.uploadUrl,
            headers: session.directUpload.headers,
            metadata: {
              title: form.title,
              filetype: mediaFile.type || 'application/octet-stream',
            },
            chunkSize: 50 * 1024 * 1024,
            retryDelays: [0, 1000, 3000, 5000],
            onError: reject,
            onProgress: (uploaded, total) => {
              if (total) setProgress(Math.round((uploaded / total) * 100))
            },
            onSuccess: resolve,
          })
          upload.start()
        })

        await mediaService.completeExternalUpload({
          ...getMetadataPayload(),
          provider: 'bunny',
          storageProvider: 'bunny',
          directUploadId: session.uploadId,
          mediaUrl: session.asset?.hlsUrl,
          hlsUrl: session.asset?.hlsUrl,
          playbackUrl: session.asset?.playbackUrl,
          thumbnailUrl: session.asset?.thumbnailUrl,
          mimeType: mediaFile.type || 'video/mp4',
          fileSize: mediaFile.size,
        })
        toast.success('Uploaded to Bunny. Video is processing and will appear when ready.')
        onSuccess()
        return
      }

      if (form.uploadProvider === 'mux') {
        const sessionRes = await mediaService.createUploadSession({
          provider: 'mux',
          title: form.title,
          type: form.type,
          mimeType: mediaFile.type,
          corsOrigin: window.location.origin,
        })
        const session = sessionRes.data.data.session

        await new Promise((resolve, reject) => {
          const request = new XMLHttpRequest()
          request.open('PUT', session.directUpload.uploadUrl)
          request.setRequestHeader('Content-Type', mediaFile.type || 'application/octet-stream')
          request.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100))
            }
          }
          request.onload = () => {
            if (request.status >= 200 && request.status < 300) resolve()
            else reject(new Error(`Mux upload failed with status ${request.status}`))
          }
          request.onerror = () => reject(new Error('Mux upload failed'))
          request.send(mediaFile)
        })

        await mediaService.completeExternalUpload({
          ...getMetadataPayload(),
          provider: 'mux',
          storageProvider: 'mux',
          directUploadId: session.uploadId,
          mimeType: mediaFile.type || 'video/mp4',
          fileSize: mediaFile.size,
        })
        toast.success('Uploaded to Mux. Video is processing and will appear when ready.')
        onSuccess()
        return
      }

      const formData = new FormData()
      formData.append('media', mediaFile)
      if (thumbnailFile) formData.append('thumbnail', thumbnailFile)
      Object.entries(form).forEach(([key, val]) => {
        if (key === 'uploadProvider') return
        formData.append(key, val.toString())
      })
      await mediaService.upload(formData)
      toast.success('Media uploaded successfully!')
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-lg rounded-2xl p-6 animate-slide-up overflow-y-auto max-h-screen"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)' }}>

        <div className="flex items-center justify-between mb-6">
          <h2 className="font-display font-bold text-xl" style={{ color: 'var(--color-text)' }}>
            Upload Media
          </h2>
          <button onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--color-surface-high)', color: 'var(--color-text-muted)' }}>
            <RiCloseFill />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Media file */}
          <div
            className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors"
            style={{ borderColor: mediaFile ? 'var(--color-primary)' : 'var(--color-border)' }}
            onClick={() => document.getElementById('media-file').click()}>
            {mediaFile ? (
              <div className="flex items-center justify-center gap-2">
                {mediaFile.type.startsWith('video') ? <RiVideoLine className="text-2xl" style={{ color: 'var(--color-primary)' }} /> : <RiMusicLine className="text-2xl" style={{ color: 'var(--color-primary)' }} />}
                <div className="text-left">
                  <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{mediaFile.name}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                    {(mediaFile.size / (1024 * 1024)).toFixed(1)} MB
                  </p>
                </div>
              </div>
            ) : (
              <>
                <RiUploadLine className="text-3xl mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  Click to select media file
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  MP4, MKV, MP3, WAV, AAC (max 500MB)
                </p>
              </>
            )}
            <input id="media-file" type="file" className="hidden"
              accept="video/*,audio/*"
              onChange={(e) => setMediaFile(e.target.files[0])} />
          </div>

          {/* Thumbnail */}
          <div
            className="border border-dashed rounded-xl p-3 text-center cursor-pointer"
            style={{ borderColor: 'var(--color-border)' }}
            onClick={() => document.getElementById('thumb-file').click()}>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {thumbnailFile ? thumbnailFile.name : '+ Add thumbnail (optional)'}
            </p>
            <input id="thumb-file" type="file" className="hidden"
              accept="image/*"
              onChange={(e) => setThumbnailFile(e.target.files[0])} />
          </div>

          <input type="text" placeholder="Title *" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="input-base" required />

          <select value={form.type}
            onChange={(e) => setForm({ ...form, type: e.target.value })}
            className="input-base">
            {MEDIA_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>

          <select value={form.uploadProvider}
            onChange={(e) => setForm({ ...form, uploadProvider: e.target.value })}
            className="input-base">
            <option value="server">Server upload (Cloudinary/current)</option>
            <option value="bunny">Direct upload to Bunny Stream</option>
            <option value="mux">Direct upload to Mux</option>
          </select>

          <textarea placeholder="Description" value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="input-base resize-none" rows={3} />

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Category" value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="input-base" />
            <input type="text" placeholder="Artist / Creator" value={form.artist}
              onChange={(e) => setForm({ ...form, artist: e.target.value })}
              className="input-base" />
          </div>

          <input type="text" placeholder="Tags (comma separated)" value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            className="input-base" />

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Genre e.g. Action" value={form.genre}
              onChange={(e) => setForm({ ...form, genre: e.target.value })}
              className="input-base" />
            <input type="number" placeholder="Release year" value={form.releaseYear}
              onChange={(e) => setForm({ ...form, releaseYear: e.target.value })}
              className="input-base" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Country e.g. Nigeria" value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className="input-base" />
            <input type="text" placeholder="Language e.g. English" value={form.language}
              onChange={(e) => setForm({ ...form, language: e.target.value })}
              className="input-base" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <input type="text" placeholder="Content rating e.g. PG-13" value={form.contentRating}
              onChange={(e) => setForm({ ...form, contentRating: e.target.value })}
              className="input-base" />
            <select value={form.releaseStatus}
              onChange={(e) => setForm({ ...form, releaseStatus: e.target.value })}
              className="input-base">
              <option value="released">Released</option>
              <option value="upcoming">Upcoming</option>
              <option value="draft">Draft</option>
              <option value="archived">Archived</option>
            </select>
          </div>

          <input type="text" placeholder="Home sections e.g. banner, movie-rankings, nollywood" value={form.homeSections}
            onChange={(e) => setForm({ ...form, homeSections: e.target.value })}
            className="input-base" />

          <input type="text" placeholder="Available countries e.g. NG, GH, US or blank for worldwide" value={form.availabilityCountries}
            onChange={(e) => setForm({ ...form, availabilityCountries: e.target.value })}
            className="input-base" />

          <div className="grid grid-cols-2 gap-3">
            <select value={form.publishStatus}
              onChange={(e) => setForm({ ...form, publishStatus: e.target.value })}
              className="input-base">
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="processing">Processing</option>
              <option value="archived">Archived</option>
            </select>
            <input type="number" placeholder="Featured rank" value={form.featuredRank}
              onChange={(e) => setForm({ ...form, featuredRank: e.target.value })}
              className="input-base" />
          </div>

          {/* Toggles */}
          <div className="flex gap-4 flex-wrap">
            {[
              { key: 'isLocked', label: '🔒 Premium only' },
              { key: 'isShort', label: '⚡ Short' },
              { key: 'isLive', label: '🔴 Live event' },
              { key: 'isFeatured', label: 'Featured/banner' },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                  className="w-4 h-4 rounded" />
                <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{label}</span>
              </label>
            ))}
          </div>

          {/* Upload progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <span>{form.uploadProvider === 'server' ? 'Uploading to Cloudinary...' : `Uploading to ${form.uploadProvider === 'bunny' ? 'Bunny' : 'Mux'}${progress ? ` (${progress}%)` : '...'}`}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--color-surface-high)' }}>
                <div className="h-full rounded-full animate-pulse"
                  style={{ width: form.uploadProvider !== 'server' && progress ? `${progress}%` : '60%', background: 'var(--color-primary)' }} />
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button type="button" onClick={onClose} className="btn-ghost flex-1">Cancel</button>
            <button type="submit" disabled={uploading} className="btn-primary flex-1">
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

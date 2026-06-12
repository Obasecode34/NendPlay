// src/services/cloudinary.service.js
//
// All Cloudinary operations live here.
// Takes a file buffer (from Multer memory storage) and streams it
// directly to Cloudinary without touching the disk.
//
// Cloudinary auto-generates a streaming URL with CDN delivery.
// For videos, it also handles adaptive bitrate streaming.

const cloudinary = require("../config/cloudinary");
const { Readable } = require("stream");

class CloudinaryService {
  // ── Upload a media file (video or audio) ──────────────────────────────
  // buffer: file buffer from multer
  // options: { folder, resourceType, publicId }
  uploadMedia(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const {
        folder = "nendplay/media",
        resourceType = "video", // Cloudinary uses "video" for both video and audio
        publicId = null,
      } = options;

      const uploadOptions = {
        folder,
        resource_type: resourceType,
        // eager: generate multiple quality versions for adaptive streaming
        eager: [
          { streaming_profile: "full_hd", format: "m3u8" }, // HLS streaming
        ],
        eager_async: true, // process in background
        use_filename: true,
        unique_filename: true,
        overwrite: false,
        // chunk_size: 6MB chunks for large file uploads
        chunk_size: 6 * 1024 * 1024,
      };

      if (publicId) uploadOptions.public_id = publicId;

      // Stream buffer to Cloudinary
      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      // Convert buffer to readable stream and pipe to Cloudinary
      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  // ── Upload a thumbnail image ──────────────────────────────────────────
  uploadThumbnail(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const { folder = "nendplay/thumbnails", publicId = null } = options;

      const uploadOptions = {
        folder,
        resource_type: "image",
        transformation: [
          { width: 1280, height: 720, crop: "fill", gravity: "center" }, // 16:9 thumbnail
          { quality: "auto", fetch_format: "auto" }, // auto-optimize format
        ],
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      };

      if (publicId) uploadOptions.public_id = publicId;

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  // ── Delete a file from Cloudinary ─────────────────────────────────────
  // Called when a media item is deleted from NendPlay
  // Upload and normalize a profile image to a square, CDN-ready avatar.
  uploadProfileImage(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const { folder = "nendplay/profiles", publicId = null } = options;

      const uploadOptions = {
        folder,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "auto" },
          { quality: "auto", fetch_format: "auto" },
        ],
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      };

      if (publicId) uploadOptions.public_id = publicId;

      const uploadStream = cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      const readableStream = new Readable();
      readableStream.push(buffer);
      readableStream.push(null);
      readableStream.pipe(uploadStream);
    });
  }

  async deleteFile(publicId, resourceType = "video") {
    try {
      const result = await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      return result;
    } catch (error) {
      // Log but don't throw — deletion failure shouldn't crash the app
      console.error(`Cloudinary delete failed for ${publicId}:`, error.message);
      return null;
    }
  }

  // ── Get video duration from Cloudinary result ──────────────────────────
  getDurationFromResult(cloudinaryResult) {
    return cloudinaryResult.duration || 0;
  }

  // ── Get file size from Cloudinary result ──────────────────────────────
  getFileSizeFromResult(cloudinaryResult) {
    return cloudinaryResult.bytes || 0;
  }

  // ── Build optimized streaming URL ────────────────────────────────────
  // For video: returns HLS URL if available, else direct URL
  getStreamingUrl(cloudinaryResult) {
    // If HLS was generated (eager transformation), use that for smooth streaming
    if (
      cloudinaryResult.eager &&
      cloudinaryResult.eager.length > 0 &&
      cloudinaryResult.eager[0].secure_url
    ) {
      return cloudinaryResult.eager[0].secure_url;
    }
    return cloudinaryResult.secure_url;
  }

  getVideoThumbnailUrl(publicId) {
    if (!publicId) return "";
    return cloudinary.url(publicId, {
      resource_type: "video",
      format: "jpg",
      transformation: [
        { start_offset: "1", width: 1280, height: 720, crop: "fill", gravity: "auto" },
        { quality: "auto", fetch_format: "auto" },
      ],
      secure: true,
    });
  }
}

module.exports = new CloudinaryService();

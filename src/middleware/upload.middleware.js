// src/middleware/upload.middleware.js
//
// Multer handles multipart/form-data (file uploads).
// Files are held in memory as buffers, then streamed to Cloudinary.
// We never write files to disk — clean and serverless-friendly.
//
// Two upload handlers:
//   uploadMedia    → accepts video or audio files
//   uploadThumbnail → accepts image files only

const multer = require("multer");
const {
  MAX_VIDEO_SIZE_MB,
  MAX_AUDIO_SIZE_MB,
  MAX_IMAGE_SIZE_MB,
} = require("../config/env");
const ApiResponse = require("../utils/apiResponse");

// ── Allowed MIME types ────────────────────────────────────────────────────
const VIDEO_TYPES = [
  "video/mp4",
  "video/mpeg",
  "video/quicktime",
  "video/x-msvideo", // .avi
  "video/x-matroska", // .mkv
  "video/webm",
];

const AUDIO_TYPES = [
  "audio/mpeg",       // .mp3
  "audio/wav",
  "audio/ogg",
  "audio/aac",
  "audio/flac",
  "audio/x-m4a",
];

const IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
];

const ALL_MEDIA_TYPES = [...VIDEO_TYPES, ...AUDIO_TYPES];

// ── Memory storage — files stay in RAM, streamed to Cloudinary ────────────
const memoryStorage = multer.memoryStorage();

// ── File filter factory ───────────────────────────────────────────────────
const createFileFilter = (allowedTypes, label) => (req, file, cb) => {
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true); // accept
  } else {
    cb(
      new Error(`Invalid file type. Allowed: ${label}`),
      false // reject
    );
  }
};

// ── Media upload (video or audio) ─────────────────────────────────────────
// Max size is whichever is larger (video limit)
const uploadMedia = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: createFileFilter(ALL_MEDIA_TYPES, "video and audio files"),
});

// ── Thumbnail upload (image only) ─────────────────────────────────────────
const uploadThumbnail = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_MB * 1024 * 1024,
    files: 1,
  },
  fileFilter: createFileFilter(IMAGE_TYPES, "JPEG, PNG, WebP images"),
});

// ── Combined: media file + optional thumbnail in one request ──────────────
const uploadMediaWithThumbnail = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "media") {
      if (ALL_MEDIA_TYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error("Invalid media file type"), false);
    }
    if (file.fieldname === "thumbnail") {
      if (IMAGE_TYPES.includes(file.mimetype)) return cb(null, true);
      return cb(new Error("Invalid thumbnail type. Use JPEG, PNG, or WebP"), false);
    }
    cb(new Error("Unexpected field name"), false);
  },
});

const uploadNewsMedia = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_VIDEO_SIZE_MB * 1024 * 1024,
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname !== "media") {
      return cb(new Error("Unexpected field name. Use media for news files."), false);
    }
    if ([...VIDEO_TYPES, ...IMAGE_TYPES].includes(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error("Invalid news file type. Upload videos or images only."), false);
  },
});

// ── Multer error handler ──────────────────────────────────────────────────
// Wraps multer errors into our standard ApiResponse format
const handleMulterError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return ApiResponse.badRequest(res, "File too large. Check the size limits.");
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return ApiResponse.badRequest(res, "Too many files. Upload one file at a time.");
    }
    return ApiResponse.badRequest(res, `Upload error: ${err.message}`);
  }
  if (err) {
    return ApiResponse.badRequest(res, err.message);
  }
  next();
};

// ── Helper: detect if uploaded file is video or audio ────────────────────
const getMediaCategory = (mimeType) => {
  if (VIDEO_TYPES.includes(mimeType)) return "video";
  if (AUDIO_TYPES.includes(mimeType)) return "audio";
  return "unknown";
};

module.exports = {
  uploadMedia,
  uploadThumbnail,
  uploadMediaWithThumbnail,
  uploadNewsMedia,
  handleMulterError,
  getMediaCategory,
  VIDEO_TYPES,
  AUDIO_TYPES,
  IMAGE_TYPES,
};

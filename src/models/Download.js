// src/models/Download.js
//
// Tracks every downloaded media file per user per device.
// The actual file lives on the client (browser Cache API or device filesystem).
// This model is the backend's record of what exists offline where.
//
// Download limits per plan:
//   mobile:   1 device
//   basic:    1 device
//   standard: 2 devices
//   premium:  6 devices
//
// A "device" here means a unique deviceId sent by the frontend.
// One device can have unlimited downloads — the limit is how many
// DIFFERENT devices can have downloads active at once.
//
// contentType covers both media and documents:
//   media    → movies, music, videos, tv shows, etc.
//   document → NovelHub documents

const mongoose = require("mongoose");

const downloadSchema = new mongoose.Schema(
  {
    // ── Who downloaded ─────────────────────────────────────────────────
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── What was downloaded ────────────────────────────────────────────
    contentType: {
      type: String,
      enum: ["media", "document"],
      required: true,
    },

    // Reference to either Media or Document model
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "contentModel",
    },

    contentModel: {
      type: String,
      enum: ["Media", "Document"],
      required: true,
    },

    // Snapshot of content info at download time
    // Stored here so offline tab works even if content is deleted from DB
    contentSnapshot: {
      title: { type: String, default: "" },
      thumbnailUrl: { type: String, default: "" },
      type: { type: String, default: "" },      // movie, music, pdf, etc.
      category: { type: String, default: "" },
      duration: { type: Number, default: 0 },   // for media
      fileSize: { type: Number, default: 0 },
      mimeType: { type: String, default: "" },
      fileUrl: { type: String, default: "" },   // Cloudinary URL
    },

    // ── Where it was downloaded ────────────────────────────────────────
    deviceId: {
      type: String,
      required: true,
    },

    deviceInfo: {
      type: String,
      default: "unknown",
    },

    // Platform: web uses Cache API, mobile uses filesystem
    platform: {
      type: String,
      enum: ["web", "mobile"],
      required: true,
    },

    // ── Client-side storage reference ──────────────────────────────────
    // Web: Cache API key used to retrieve the file
    // Mobile: local filesystem path on the device
    storageKey: {
      type: String,
      default: "",
    },

    // ── Status ─────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "deleted"],
      default: "pending",
    },

    downloadedAt: {
      type: Date,
      default: null,
    },

    // File size actually stored on device (bytes)
    storedFileSize: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
downloadSchema.index({ userId: 1, status: 1 });
downloadSchema.index({ userId: 1, deviceId: 1 });
downloadSchema.index({ userId: 1, contentId: 1, deviceId: 1 }, { unique: true });
downloadSchema.index({ contentType: 1, userId: 1 });

module.exports = mongoose.model("Download", downloadSchema);

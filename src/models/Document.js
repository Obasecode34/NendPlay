// src/models/Document.js
//
// The Document model covers all file types in NovelHub:
// PDF, DOCX, TXT, EPUB, PPT, XLS, and more.
//
// Fork system:
//   originalDocument: null  = this is an original upload
//   originalDocument: <id>  = this is a fork (personal copy) of another document
//
// All uploads are public and accessible by all users.
// Only the uploader can delete their own document.
// Editing = forking — the original is never modified.

const mongoose = require("mongoose");

const documentSchema = new mongoose.Schema(
  {
    // ── Identity ───────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [2000, "Description cannot exceed 2000 characters"],
      default: "",
    },

    // ── File Info ──────────────────────────────────────────────────────
    fileUrl: {
      type: String,
      required: [true, "File URL is required"],
    },

    // Cloudinary public_id — needed to delete from Cloudinary
    cloudinaryPublicId: {
      type: String,
      default: null,
    },

    fileType: {
      type: String,
      required: [true, "File type is required"],
      enum: [
        "pdf",
        "docx",
        "doc",
        "txt",
        "epub",
        "pptx",
        "ppt",
        "xlsx",
        "xls",
        "csv",
        "other",
      ],
    },

    mimeType: {
      type: String,
      default: "",
    },

    fileSize: {
      type: Number, // bytes
      default: 0,
    },

    // ── Categorization ─────────────────────────────────────────────────
    category: {
      type: String,
      trim: true,
      default: "fiction",
    },

    tags: {
      type: [String],
      default: [],
    },

    genre: {
      type: String,
      trim: true,
      default: "fiction",
    },

    // ── Author Info ────────────────────────────────────────────────────
    // The real-world author (not the uploader)
    author: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Fork System ────────────────────────────────────────────────────
    // null = original document
    // ObjectId = this is a fork of another document
    originalDocument: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
      default: null,
    },

    isFork: {
      type: Boolean,
      default: false,
    },

    // How many times this document has been forked
    forkCount: {
      type: Number,
      default: 0,
    },

    // ── Upload Info ────────────────────────────────────────────────────
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // ── Engagement ─────────────────────────────────────────────────────
    downloadCount: {
      type: Number,
      default: 0,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    likeCount: {
      type: Number,
      default: 0,
    },

    // ── Status ─────────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
documentSchema.index({
  title: "text",
  description: "text",
  category: "text",
  genre: "text",
  tags: "text",
  author: "text",
});

documentSchema.index({ fileType: 1, isActive: 1 });
documentSchema.index({ category: 1, isActive: 1 });
documentSchema.index({ genre: 1, isActive: 1 });
documentSchema.index({ fileType: 1, category: 1, isActive: 1, createdAt: -1 });
documentSchema.index({ uploadedBy: 1, isActive: 1 });
documentSchema.index({ originalDocument: 1 });
documentSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Document", documentSchema);

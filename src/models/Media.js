// src/models/Media.js
//
// The Media model covers every content type on NendPlay:
// movies, videos, music, tv shows, comedies, talk shows,
// podcasts, shorts, and live events.
//
// Two storage strategies:
//   - Uploaded files  → stored on Cloudinary (mediaUrl = Cloudinary URL)
//   - External links  → stored as-is (mediaUrl = YouTube, etc.)
//
// isLocked: true  = only subscribed users can access
// isLocked: false = free for everyone
//
// isShort: true = max 3 minutes, appears in Shorts tab
// isLive:  true = live event, always shows ads regardless of subscription

const mongoose = require("mongoose");

const LICENSE_TYPES = [
  "unknown",
  "public_domain",
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
  "standard_license",
  "owned",
  "permission_granted",
];

const mediaSchema = new mongoose.Schema(
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

    // ── Content Type ───────────────────────────────────────────────────
    type: {
      type: String,
      required: [true, "Media type is required"],
      enum: [
        "movie",
        "video",
        "music",
        "tv_show",
        "comedy",
        "talk_show",
        "podcast",
        "short",
        "live_event",
      ],
    },

    category: {
      type: String,
      trim: true,
      default: "general",
    },

    tags: {
      type: [String],
      default: [],
    },

    genre: {
      type: String,
      trim: true,
      default: "",
    },

    language: {
      type: String,
      trim: true,
      default: "",
    },

    country: {
      type: String,
      trim: true,
      default: "",
    },

    contentRating: {
      type: String,
      trim: true,
      default: "",
    },

    releaseStatus: {
      type: String,
      enum: ["released", "upcoming", "draft", "archived"],
      default: "released",
    },

    publishStatus: {
      type: String,
      enum: ["draft", "processing", "pending_review", "published", "rejected", "failed", "archived"],
      default: "pending_review",
    },

    reviewStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },

    reviewNote: {
      type: String,
      trim: true,
      maxlength: [1000, "Review note cannot exceed 1000 characters"],
      default: "",
    },

    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    reviewedAt: {
      type: Date,
      default: null,
    },

    homeSections: {
      type: [String],
      default: [],
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },

    featuredRank: {
      type: Number,
      default: 0,
    },

    availabilityCountries: {
      type: [String],
      default: [],
    },

    // Rights metadata for public-domain, Creative Commons, owned, or licensed content.
    licenseType: {
      type: String,
      enum: LICENSE_TYPES,
      default: "unknown",
    },

    licenseUrl: {
      type: String,
      trim: true,
      default: "",
    },

    sourceUrl: {
      type: String,
      trim: true,
      default: "",
    },

    sourceName: {
      type: String,
      trim: true,
      default: "",
    },

    attributionText: {
      type: String,
      trim: true,
      maxlength: [500, "Attribution cannot exceed 500 characters"],
      default: "",
    },

    rightsSummary: {
      type: String,
      trim: true,
      maxlength: [1000, "Rights summary cannot exceed 1000 characters"],
      default: "",
    },

    requiresAttribution: {
      type: Boolean,
      default: false,
    },

    isRightsVerified: {
      type: Boolean,
      default: false,
    },

    rightsVerifiedAt: {
      type: Date,
      default: null,
    },

    // ── Media Files ────────────────────────────────────────────────────
    mediaUrl: {
      type: String,
      required: [true, "Media URL is required"],
    },

    playbackUrl: {
      type: String,
      default: "",
    },

    hlsUrl: {
      type: String,
      default: "",
    },

    storageProvider: {
      type: String,
      enum: ["cloudinary", "external", "s3", "r2", "bunny", "mux", "local"],
      default: "cloudinary",
    },

    storageKey: {
      type: String,
      default: "",
    },

    transcodingProvider: {
      type: String,
      enum: ["cloudinary", "none", "bunny", "mux", "aws-mediaconvert"],
      default: "cloudinary",
    },

    processingStatus: {
      type: String,
      enum: ["uploaded", "queued", "processing", "ready", "failed"],
      default: "ready",
    },

    processingError: {
      type: String,
      default: "",
    },

    // Cloudinary public_id — needed to delete files from Cloudinary
    cloudinaryPublicId: {
      type: String,
      default: null,
    },

    thumbnailUrl: {
      type: String,
      default: "",
    },

    thumbnailCloudinaryId: {
      type: String,
      default: null,
    },

    // ── Media Metadata ─────────────────────────────────────────────────
    duration: {
      type: Number, // duration in seconds
      default: 0,
    },

    fileSize: {
      type: Number, // size in bytes
      default: 0,
    },

    mimeType: {
      type: String,
      default: "",
    },

    // For music: artist name
    artist: {
      type: String,
      trim: true,
      default: "",
    },

    // For movies/shows: release year
    releaseYear: {
      type: Number,
      default: null,
    },

    // ── Access Control ─────────────────────────────────────────────────
    // isLocked: true = subscription required to watch
    isLocked: {
      type: Boolean,
      default: false,
    },

    // isShort: true = appears in Shorts tab, max 3 minutes enforced
    isShort: {
      type: Boolean,
      default: false,
    },

    // isLive: true = live event, ads always shown even for subscribers
    isLive: {
      type: Boolean,
      default: false,
    },

    // Live event scheduled time
    liveScheduledAt: {
      type: Date,
      default: null,
    },

    liveEndedAt: {
      type: Date,
      default: null,
    },

    // ── Upload Info ────────────────────────────────────────────────────
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // isUserUpload: true = uploaded by a regular user (publicly accessible)
    // isUserUpload: false = uploaded by admin
    isUserUpload: {
      type: Boolean,
      default: true,
    },

    originalMedia: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
      default: null,
    },

    remixCount: {
      type: Number,
      default: 0,
    },

    // ── Engagement ─────────────────────────────────────────────────────
    viewCount: {
      type: Number,
      default: 0,
    },

    likeCount: {
      type: Number,
      default: 0,
    },

    dislikeCount: {
      type: Number,
      default: 0,
    },

    commentCount: {
      type: Number,
      default: 0,
    },

    savedCount: {
      type: Number,
      default: 0,
    },

    comments: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        text: {
          type: String,
          required: true,
          trim: true,
          maxlength: [500, "Comment cannot exceed 500 characters"],
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],

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

// ── Indexes for fast search ────────────────────────────────────────────────
// Text index enables full-text search across catalog metadata
mediaSchema.index({
  title: "text",
  description: "text",
  tags: "text",
  artist: "text",
  genre: "text",
  category: "text",
  language: "text",
  country: "text",
  homeSections: "text",
  licenseType: "text",
  sourceName: "text",
  attributionText: "text",
});

// Compound indexes for common filter queries
mediaSchema.index({ type: 1, isActive: 1 });
mediaSchema.index({ isLocked: 1, isActive: 1 });
mediaSchema.index({ isShort: 1, isActive: 1 });
mediaSchema.index({ homeSections: 1, isActive: 1 });
mediaSchema.index({ publishStatus: 1, isActive: 1 });
mediaSchema.index({ country: 1, language: 1, isActive: 1 });
mediaSchema.index({ uploadedBy: 1, isActive: 1 });
mediaSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Media", mediaSchema);

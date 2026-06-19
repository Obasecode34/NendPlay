// src/models/Ad.js
//
// NendPlay Native Ad model.
// Advertisers submit ads and pay before they go live.
//
// Ad display rules:
//   - Unsubscribed users: see native ads + Google AdMob
//   - Subscribed users:   no ads EXCEPT during live events
//   - Live events:        native ads shown as overlays/banners (non-interrupting)
//                         AdMob NOT shown during live events (native ads only)
//
// Ad types:
//   banner      → static image displayed above/below content
//   video       → short video ad (non-interrupting, plays in sidebar or overlay)
//   overlay     → semi-transparent overlay on live event stream
//
// Payment flow:
//   1. Advertiser submits ad + pays
//   2. Ad status: "pending_payment"
//   3. Payment confirmed → status: "pending_review"
//   4. Admin approves → status: "active"
//   5. Ad serves until expiryDate → status: "expired"

const mongoose = require("mongoose");

const adSchema = new mongoose.Schema(
  {
    // ── Advertiser Info ────────────────────────────────────────────────
    advertiserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    advertiserName: {
      type: String,
      trim: true,
      required: [true, "Advertiser name is required"],
    },

    // ── Ad Content ─────────────────────────────────────────────────────
    title: {
      type: String,
      required: [true, "Ad title is required"],
      trim: true,
      maxlength: [100, "Title cannot exceed 100 characters"],
    },

    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
      default: "",
    },

    // URL of the ad media (image or video) — stored on Cloudinary
    mediaUrl: {
      type: String,
      default: "",
    },

    cloudinaryPublicId: {
      type: String,
      default: null,
    },

    // Where clicking the ad takes the user
    targetUrl: {
      type: String,
      trim: true,
      default: "",
    },

    // ── Ad Type ────────────────────────────────────────────────────────
    adType: {
      type: String,
      enum: ["banner", "video", "overlay"],
      required: [true, "Ad type is required"],
    },

    // ── Targeting ──────────────────────────────────────────────────────
    // Where this ad appears
    placement: {
      type: String,
      enum: [
        "home",         // Home tab
        "media",        // During media playback
        "news",         // Daily news and article screens
        "downloads",    // Downloads tab
        "profile",      // Profile/settings screens
        "subscription", // Subscription and rewards screens
        "live_event",   // Live events only (overlays/banners)
        "novels",       // NovelHub
        "shorts",       // Shorts tab
        "all",          // Everywhere applicable
      ],
      default: "all",
    },

    // Show to specific subscription status
    targetAudience: {
      type: String,
      enum: ["unsubscribed", "all"],
      default: "unsubscribed",
      // "all" is used for live_event placement since even subscribers see those
    },

    // ── Payment Info ───────────────────────────────────────────────────
    priceNaira: {
      type: Number,
      required: true,
    },

    paymentGateway: {
      type: String,
      enum: ["paystack", "flutterwave", "admin_comp"],
      default: "paystack",
    },

    transactionRef: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },

    gatewayTransactionId: {
      type: String,
      default: null,
    },

    isPaid: {
      type: Boolean,
      default: false,
    },

    paidAt: {
      type: Date,
      default: null,
    },

    // ── Ad Duration ────────────────────────────────────────────────────
    // How long the ad runs after activation
    durationDays: {
      type: Number,
      required: true,
      min: [1, "Ad must run for at least 1 day"],
      max: [365, "Ad cannot run for more than 365 days"],
    },

    startDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },

    // ── Status ─────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: [
        "pending_payment", // submitted, awaiting payment
        "pending_review",  // paid, awaiting admin approval
        "active",          // approved, currently serving
        "paused",          // temporarily stopped
        "expired",         // past expiryDate
        "rejected",        // rejected by admin
      ],
      default: "pending_payment",
    },

    rejectionReason: {
      type: String,
      default: "",
    },

    // ── Analytics ──────────────────────────────────────────────────────
    impressions: {
      type: Number,
      default: 0,
    },

    clicks: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// ── Indexes ────────────────────────────────────────────────────────────────
adSchema.index({ status: 1, placement: 1 });
adSchema.index({ status: 1, targetAudience: 1 });
adSchema.index({ expiryDate: 1, status: 1 });
adSchema.index({ advertiserId: 1, status: 1 });

module.exports = mongoose.model("Ad", adSchema);

const mongoose = require("mongoose");

const analyticsEventSchema = new mongoose.Schema(
  {
    eventType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    screen: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },
    section: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },
    contentType: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "",
      index: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    userRole: {
      type: String,
      enum: ["guest", "user", "admin", "super_admin"],
      default: "guest",
      index: true,
    },
    guestId: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
      index: true,
    },
    platform: {
      type: String,
      enum: ["web", "mobile", "unknown"],
      default: "unknown",
      index: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
);

analyticsEventSchema.index({ createdAt: -1 });
analyticsEventSchema.index({ eventType: 1, createdAt: -1 });
analyticsEventSchema.index({ platform: 1, createdAt: -1 });

module.exports = mongoose.model("AnalyticsEvent", analyticsEventSchema);

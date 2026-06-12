const mongoose = require("mongoose");

const inAppNotificationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    body: {
      type: String,
      required: true,
      trim: true,
      maxlength: 800,
    },
    audience: {
      type: String,
      enum: ["all", "users", "admins", "subscribers", "free_users", "selected_users"],
      default: "all",
      index: true,
    },
    userIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    sentBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    screen: {
      type: String,
      default: "Home",
      trim: true,
    },
    contentType: {
      type: String,
      enum: ["", "news", "media"],
      default: "",
      trim: true,
    },
    contentId: {
      type: String,
      default: "",
      trim: true,
    },
    data: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    imageUrl: {
      type: String,
      default: "",
    },
    imageCloudinaryId: {
      type: String,
      default: "",
    },
    readBy: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        readAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expiresAt: {
      type: Date,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

inAppNotificationSchema.index({ createdAt: -1 });
inAppNotificationSchema.index({ userIds: 1 });
inAppNotificationSchema.index({ "readBy.userId": 1 });

module.exports = mongoose.model("InAppNotification", inAppNotificationSchema);

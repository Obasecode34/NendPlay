// src/models/Session.js
//
// Tracks active streaming sessions per user.
// Used to enforce concurrent stream limits per subscription plan.
//
// How it works:
//   - When a user starts streaming, a Session is created
//   - When they stop (or timeout), the Session is deleted
//   - Before allowing a new stream, we count active sessions
//   - If count >= plan limit, we block the new stream
//
// TTL index: sessions auto-expire after 4 hours of inactivity.
// This handles cases where a user closes the browser without logging out —
// their session doesn't block other devices forever.
//
// Think of it like a bouncer counting people in a room.
// The room has a capacity (plan limit).
// People who've been inactive for 4 hours are considered to have left.

const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  mediaId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media",
    required: true,
  },

  deviceId: {
    type: String,
    required: true,
  },

  deviceInfo: {
    type: String,
    default: "unknown",
  },

  // TTL index: MongoDB auto-deletes this document 4 hours after lastActive
  lastActive: {
    type: Date,
    default: Date.now,
    index: { expires: "4h" },
  },

  startedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index: find all active sessions for a user quickly
sessionSchema.index({ userId: 1, deviceId: 1 });

module.exports = mongoose.model("Session", sessionSchema);

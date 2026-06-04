// src/models/Token.js
//
// Stores refresh tokens in the database.
// Why store refresh tokens? So we can invalidate them on logout.
// Without this, a stolen refresh token works until it expires (7 days).
// With this, logout = delete the token = it's dead immediately.
//
// This is "refresh token rotation":
//   1. User logs in → get access token (15min) + refresh token (7d)
//   2. Access token expires → use refresh token to get a NEW access token
//      AND a NEW refresh token (old one deleted)
//   3. User logs out → delete refresh token from DB
//
// The TTL index (expiresAt) auto-deletes documents when they expire.
// MongoDB handles the cleanup — no cron job needed.

const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },

  token: {
    type: String,
    required: true,
    unique: true,
  },

  // TTL index: MongoDB auto-deletes this document at expiresAt
  expiresAt: {
    type: Date,
    required: true,
    index: { expires: 0 }, // 0 = delete AT the expiresAt time
  },

  // Track where the token came from — useful for security audits
  deviceInfo: {
    type: String,
    default: "unknown",
  },

  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Token", tokenSchema);

// src/models/Referral.js
//
// Tracks every referral relationship between users.
// One document per successful referral.
//
// A referral is "successful" when a new user signs up
// using an existing user's referral code.
//
// rewardGranted: true = this referral contributed to a reward
// that was already activated. Prevents double-counting.

const mongoose = require("mongoose");

const referralSchema = new mongoose.Schema(
  {
    // The user who shared the referral code
    referrerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // The new user who signed up using the code
    referredUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true, // one referral record per referred user
    },

    // The referral code that was used
    referralCode: {
      type: String,
      required: true,
    },

    // Whether this referral was counted toward a reward
    rewardGranted: {
      type: Boolean,
      default: false,
    },

    // Which reward tier this referral helped unlock
    rewardTierUnlocked: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

referralSchema.index({ referrerId: 1, createdAt: -1 });

module.exports = mongoose.model("Referral", referralSchema);

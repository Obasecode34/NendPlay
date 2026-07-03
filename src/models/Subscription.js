// src/models/Subscription.js
//
// Tracks every subscription transaction and status.
// One active subscription per user at a time.
// History is preserved — cancelled/expired subscriptions stay in DB.
//
// Payment flow:
//   1. User picks a plan
//   2. Backend creates a Subscription with status: "pending"
//   3. Backend initializes payment with the selected gateway
//   4. User pays on the payment page
//   5. Gateway calls our webhook with payment confirmation
//   6. Webhook handler updates Subscription to status: "active"
//   7. User model gets subscriptionPlan + subscriptionExpiry updated

const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // ── Plan Info ──────────────────────────────────────────────────────
    plan: {
      type: String,
      enum: ["mobile", "basic", "standard", "premium"],
      required: true,
    },

    priceNaira: {
      type: Number,
      required: true,
    },

    // ── Payment Info ───────────────────────────────────────────────────
    paymentGateway: {
      type: String,
      enum: ["paystack", "flutterwave", "opay", "palmpay"],
      required: true,
    },

    // Transaction reference from the gateway
    transactionRef: {
      type: String,
      unique: true,
      required: true,
    },

    // Gateway's own transaction ID (returned after verification)
    gatewayTransactionId: {
      type: String,
      default: null,
    },

    // ── Status ─────────────────────────────────────────────────────────
    status: {
      type: String,
      enum: ["pending", "active", "cancelled", "expired", "failed"],
      default: "pending",
    },

    // ── Duration ───────────────────────────────────────────────────────
    startDate: {
      type: Date,
      default: null,
    },

    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },

    // ── Cancellation ───────────────────────────────────────────────────
    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelReason: {
      type: String,
      default: "",
    },

    // ── Reward Subscription (from referral system) ─────────────────────
    isReward: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for common queries
subscriptionSchema.index({ userId: 1, status: 1 });
// subscriptionSchema.index({ transactionRef: 1 });
subscriptionSchema.index({ expiryDate: 1, status: 1 });

module.exports = mongoose.model("Subscription", subscriptionSchema);

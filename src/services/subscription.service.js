// src/services/subscription.service.js
//
// All subscription business logic.
// Orchestrates between PaymentService, Subscription model, and User model.

const Subscription = require("../models/Subscription");
const User = require("../models/User");
const Session = require("../models/Session");
const paymentService = require("./payment.service");
const { getPlan, getAllPlans } = require("../config/plans");
const { nanoid } = require("nanoid");

class SubscriptionService {
  // ── Get all available plans ────────────────────────────────────────────
  getPlans() {
    return getAllPlans();
  }

  // ── Initialize subscription payment ───────────────────────────────────
  // Creates a pending Subscription record and returns payment URL
  async initializeSubscription({ userId, planId, gateway }) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    // User must have an email to pay (payment gateways require email)
    if (!user.email) {
      throw {
        status: 400,
        message: "Please add an email address to your profile before subscribing.",
      };
    }

    // Get plan details
    const plan = getPlan(planId);

    // Generate unique transaction reference
    const transactionRef = `NP-${nanoid(16).toUpperCase()}`;

    // Create pending subscription record
    await Subscription.create({
      userId,
      plan: planId,
      priceNaira: plan.monthlyPriceNaira,
      paymentGateway: gateway,
      transactionRef,
      status: "pending",
    });

    // Initialize payment with the chosen gateway
    const paymentData = await paymentService.initializePayment({
      gateway,
      email: user.email,
      amountNaira: plan.monthlyPriceNaira,
      planId,
      userId,
      transactionRef,
    });

    return {
      paymentUrl: paymentData.paymentUrl,
      transactionRef,
      plan: plan.name,
      amount: plan.monthlyPriceNaira,
      gateway,
    };
  }

  // ── Verify and activate subscription ──────────────────────────────────
  // Called after user returns from payment page
  async verifyAndActivate({ transactionRef, gateway }) {
    // Find the pending subscription
    const subscription = await Subscription.findOne({ transactionRef });
    if (!subscription) {
      throw { status: 404, message: "Subscription record not found" };
    }

    if (subscription.status === "active") {
      return { message: "Subscription already active", subscription };
    }

    if (subscription.status === "failed") {
      throw { status: 400, message: "This payment has already failed" };
    }

    // Verify with the gateway
    const verification = await paymentService.verifyPayment({
      gateway,
      transactionRef,
    });

    if (!verification.verified) {
      // Mark as failed
      await Subscription.findByIdAndUpdate(subscription._id, { status: "failed" });
      throw { status: 400, message: "Payment verification failed. Please try again." };
    }

    // Payment confirmed — activate subscription
    const now = new Date();
    const expiry = new Date(now);
    expiry.setMonth(expiry.getMonth() + 1); // 1 month from now

    await Subscription.findByIdAndUpdate(subscription._id, {
      status: "active",
      gatewayTransactionId: verification.gatewayTransactionId,
      startDate: now,
      expiryDate: expiry,
    });

    // Update user's subscription info
    await User.findByIdAndUpdate(subscription.userId, {
      subscriptionPlan: subscription.plan,
      subscriptionExpiry: expiry,
      isSubscriptionActive: true,
    });

    const updatedSubscription = await Subscription.findById(subscription._id);
    return {
      message: "Subscription activated successfully",
      subscription: updatedSubscription,
      expiryDate: expiry,
    };
  }

  // ── Handle Paystack webhook ────────────────────────────────────────────
  async handlePaystackWebhook(rawBody, signature, payload) {
    // Verify signature
    const isValid = paymentService.verifyPaystackWebhook(rawBody, signature);
    if (!isValid) throw { status: 401, message: "Invalid webhook signature" };

    if (payload.event === "charge.success") {
      const transactionRef = payload.data?.reference;
      if (transactionRef) {
        const isAdFreePass = transactionRef.startsWith("NP-ADFREE-");
        const service = isAdFreePass ? require("./reward.service") : this;
        const action = isAdFreePass
          ? service.verifyPaidAdFree({ transactionRef, gateway: "paystack" })
          : service.verifyAndActivate({ transactionRef, gateway: "paystack" });
        await action.catch(err => console.error("Webhook activation error:", err.message));
      }
    }

    return { received: true };
  }

  // ── Handle Flutterwave webhook ─────────────────────────────────────────
  async handleFlutterwaveWebhook(signature, payload) {
    const isValid = paymentService.verifyFlutterwaveWebhook(signature);
    if (!isValid) throw { status: 401, message: "Invalid webhook signature" };

    if (payload.event === "charge.completed" && payload.data?.status === "successful") {
      const transactionRef = payload.data?.tx_ref;
      if (transactionRef) {
        const isAdFreePass = transactionRef.startsWith("NP-ADFREE-");
        const service = isAdFreePass ? require("./reward.service") : this;
        const action = isAdFreePass
          ? service.verifyPaidAdFree({ transactionRef, gateway: "flutterwave" })
          : service.verifyAndActivate({ transactionRef, gateway: "flutterwave" });
        await action.catch(err => console.error("Webhook activation error:", err.message));
      }
    }

    return { received: true };
  }

  // ── Cancel subscription ────────────────────────────────────────────────
  // User can cancel at any time. Access continues until expiry date.
  async cancelSubscription(userId, reason = "") {
    const subscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (!subscription) {
      throw { status: 404, message: "No active subscription found" };
    }

    await Subscription.findByIdAndUpdate(subscription._id, {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelReason: reason,
    });

    // Don't immediately remove access — user paid for the full month
    // Access expires naturally at expiryDate
    // A cron job (Phase 7) will clean up expired subscriptions

    return {
      message: "Subscription cancelled. You'll retain access until " +
        subscription.expiryDate.toDateString(),
      expiryDate: subscription.expiryDate,
    };
  }

  // ── Get user's current subscription ───────────────────────────────────
  async getUserSubscription(userId) {
    const subscription = await Subscription.findOne({
      userId,
      status: { $in: ["active", "cancelled"] },
    }).sort({ createdAt: -1 });

    const user = await User.findById(userId);
    const isActive = user?.hasActiveSubscription() || false;

    return {
      subscription,
      isActive,
      plan: user?.subscriptionPlan || "none",
      expiryDate: user?.subscriptionExpiry || null,
    };
  }

  // ── Get subscription history ───────────────────────────────────────────
  async getSubscriptionHistory(userId) {
    return Subscription.find({ userId }).sort({ createdAt: -1 });
  }

  // ── Check concurrent stream limit ─────────────────────────────────────
  async canStartStream(userId, deviceId, mediaId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    const { getPlan } = require("../config/plans");

    // Free users can't stream locked content (handled separately)
    // For subscribed users, check concurrent stream limit
    if (user.subscriptionPlan === "none" || !user.hasActiveSubscription()) {
      return { allowed: true, reason: "free" }; // free content has no stream limit
    }

    const plan = getPlan(user.subscriptionPlan);
    const maxStreams = plan.maxConcurrentStreams;

    // Count active sessions for this user (excluding this device)
    const activeSessions = await Session.countDocuments({
      userId,
      deviceId: { $ne: deviceId },
    });

    if (activeSessions >= maxStreams) {
      return {
        allowed: false,
        reason: `Your ${plan.name} plan allows ${maxStreams} concurrent stream(s). Stop streaming on another device first.`,
      };
    }

    return { allowed: true, reason: "ok" };
  }

  // ── Start stream session ───────────────────────────────────────────────
  async startSession(userId, deviceId, mediaId, deviceInfo) {
    // Upsert — if session exists for this device, update it
    await Session.findOneAndUpdate(
      { userId, deviceId },
      { userId, deviceId, mediaId, deviceInfo, lastActive: new Date() },
      { upsert: true, new: true }
    );
  }

  // ── End stream session ─────────────────────────────────────────────────
  async endSession(userId, deviceId) {
    await Session.deleteOne({ userId, deviceId });
  }

  // ── Keep session alive (heartbeat) ────────────────────────────────────
  async pingSession(userId, deviceId) {
    await Session.findOneAndUpdate(
      { userId, deviceId },
      { lastActive: new Date() }
    );
  }
}

module.exports = new SubscriptionService();

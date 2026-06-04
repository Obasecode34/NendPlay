// src/services/referral.service.js
//
// All referral and reward business logic.
//
// Referral flow:
//   1. User A shares their referralCode (e.g. NP-X7K2M9PQ)
//   2. User B signs up with that code (handled in auth.service.js)
//   3. auth.service.js calls referral.service.recordReferral()
//   4. recordReferral creates a Referral document + increments referralCount
//   5. checkAndGrantReward runs — if threshold hit, grant free subscription
//
// Reward flow:
//   1. referralCount hits a tier threshold (e.g. 5 referrals)
//   2. User gets a free subscription for the tier's duration
//   3. If user already has a paid subscription, reward extends it
//   4. rewardActive = true on User, rewardExpiry set
//   5. Cron job checks daily for expired rewards

const Referral = require("../models/Referral");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const { getEligibleTier, getNextTier, REWARD_TIERS } = require("../config/rewardTiers");
const { nanoid } = require("nanoid");

class ReferralService {
  // ── Record a new referral ─────────────────────────────────────────────
  // Called from auth.service.js after a new user signs up with a referral code
  async recordReferral(referrerId, referredUserId, referralCode) {
    try {
      // Check if this user was already referred (prevent duplicate records)
      const existing = await Referral.findOne({ referredUserId });
      if (existing) return null;

      // Create referral record
      const referral = await Referral.create({
        referrerId,
        referredUserId,
        referralCode,
      });

      // Check and grant reward if threshold reached
      await this.checkAndGrantReward(referrerId);

      return referral;
    } catch (err) {
      // Non-fatal — referral tracking failure shouldn't break registration
      console.error("Record referral error:", err.message);
      return null;
    }
  }

  // ── Check if referrer qualifies for a reward ──────────────────────────
  async checkAndGrantReward(userId) {
    const user = await User.findById(userId);
    if (!user) return null;

    const referralCount = user.referralCount;
    const eligibleTier = getEligibleTier(referralCount);

    if (!eligibleTier) return null; // No tier reached yet

    // Check if this tier was already granted
    // We track this by checking if there's a reward subscription
    // for this tier already active or recently expired
    const existingReward = await Subscription.findOne({
      userId,
      isReward: true,
      status: { $in: ["active", "cancelled"] },
      // Check if this tier or higher was already given
    });

    // If user already has an active reward subscription at same or better tier
    if (existingReward && existingReward.status === "active") {
      const existingPlanIndex = REWARD_TIERS.findIndex(
        (t) => t.plan === existingReward.plan
      );
      const newPlanIndex = REWARD_TIERS.findIndex(
        (t) => t.plan === eligibleTier.plan
      );

      // If existing reward is same or better — don't downgrade
      if (existingPlanIndex <= newPlanIndex) return null;
    }

    // Grant the reward
    return this._grantReward(user, eligibleTier);
  }

  // ── Grant a reward subscription ───────────────────────────────────────
  async _grantReward(user, tier) {
    const now = new Date();
    const expiry = new Date(now);
    expiry.setDate(expiry.getDate() + tier.durationDays);

    // Create reward subscription record
    const rewardSub = await Subscription.create({
      userId: user._id,
      plan: tier.plan,
      priceNaira: 0, // free
      paymentGateway: "paystack", // placeholder
      transactionRef: `NP-REWARD-${nanoid(12).toUpperCase()}`,
      status: "active",
      startDate: now,
      expiryDate: expiry,
      isReward: true,
    });

    // Update user's subscription if:
    // 1. They have no active subscription, OR
    // 2. The reward plan is better than their current plan
    const shouldUpgrade =
      !user.hasActiveSubscription() ||
      this._isPlanBetter(tier.plan, user.subscriptionPlan);

    if (shouldUpgrade) {
      await User.findByIdAndUpdate(user._id, {
        subscriptionPlan: tier.plan,
        subscriptionExpiry: expiry,
        isSubscriptionActive: true,
        rewardActive: true,
        rewardExpiry: expiry,
      });
    } else {
      // Just mark reward as active even if plan isn't upgraded
      await User.findByIdAndUpdate(user._id, {
        rewardActive: true,
        rewardExpiry: expiry,
      });
    }

    // Mark all referrals as rewardGranted for this tier
    await Referral.updateMany(
      { referrerId: user._id, rewardGranted: false },
      {
        rewardGranted: true,
        rewardTierUnlocked: tier.id,
      }
    );

    console.log(
      `🎁  Reward granted to user ${user._id}: ${tier.plan} for ${tier.durationDays} days`
    );

    return rewardSub;
  }

  // ── Check if planA is better than planB ───────────────────────────────
  _isPlanBetter(planA, planB) {
    const order = ["none", "mobile", "basic", "standard", "premium"];
    return order.indexOf(planA) > order.indexOf(planB);
  }

  // ── Get referral dashboard for a user ────────────────────────────────
  async getReferralDashboard(userId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    // Get referral history
    const referrals = await Referral.find({ referrerId: userId })
      .populate("referredUserId", "profileName username createdAt")
      .sort({ createdAt: -1 })
      .lean();

    const referralCount = user.referralCount;
    const eligibleTier = getEligibleTier(referralCount);
    const nextTier = getNextTier(referralCount);

    // Get active reward subscription if any
    const activeReward = await Subscription.findOne({
      userId,
      isReward: true,
      status: "active",
    });

    return {
      referralCode: user.referralCode,
      referralCount,
      referrals: referrals.map((r) => ({
        id: r._id,
        referredUser: r.referredUserId,
        joinedAt: r.createdAt,
        rewardGranted: r.rewardGranted,
      })),
      currentReward: activeReward
        ? {
            plan: activeReward.plan,
            expiryDate: activeReward.expiryDate,
            daysRemaining: Math.max(
              0,
              Math.ceil(
                (new Date(activeReward.expiryDate) - new Date()) /
                  (1000 * 60 * 60 * 24)
              )
            ),
          }
        : null,
      eligibleTier: eligibleTier
        ? {
            plan: eligibleTier.plan,
            durationDays: eligibleTier.durationDays,
            label: eligibleTier.label,
          }
        : null,
      nextTier: nextTier
        ? {
            plan: nextTier.plan,
            durationDays: nextTier.durationDays,
            referralsNeeded: nextTier.referralsNeeded,
            label: nextTier.label,
          }
        : null,
      allTiers: REWARD_TIERS,
    };
  }

  // ── Get referral link ─────────────────────────────────────────────────
  getReferralLink(referralCode, clientUrl) {
    return `${clientUrl}/register?ref=${referralCode}`;
  }

  // ── Expire old reward subscriptions ──────────────────────────────────
  // Called by cron job daily
  async expireRewards() {
    const now = new Date();

    // Find expired reward subscriptions
    const expiredRewards = await Subscription.find({
      isReward: true,
      status: "active",
      expiryDate: { $lt: now },
    });

    for (const reward of expiredRewards) {
      // Mark reward as expired
      await Subscription.findByIdAndUpdate(reward._id, {
        status: "expired",
      });

      // Check if user has a paid subscription to fall back to
      const paidSub = await Subscription.findOne({
        userId: reward.userId,
        isReward: false,
        status: "active",
        expiryDate: { $gt: now },
      });

      if (paidSub) {
        // Fall back to paid subscription
        await User.findByIdAndUpdate(reward.userId, {
          subscriptionPlan: paidSub.plan,
          subscriptionExpiry: paidSub.expiryDate,
          isSubscriptionActive: true,
          rewardActive: false,
          rewardExpiry: null,
        });
      } else {
        // No paid subscription — remove access
        await User.findByIdAndUpdate(reward.userId, {
          subscriptionPlan: "none",
          subscriptionExpiry: null,
          isSubscriptionActive: false,
          rewardActive: false,
          rewardExpiry: null,
        });
      }
    }

    return { expired: expiredRewards.length };
  }

  // ── Manually trigger reward check (for testing) ───────────────────────
  async triggerRewardCheck(userId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };
    const result = await this.checkAndGrantReward(userId);
    return result;
  }
}

module.exports = new ReferralService();

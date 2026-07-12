const { nanoid } = require("nanoid");
const User = require("../models/User");
const Subscription = require("../models/Subscription");
const RewardLedger = require("../models/RewardLedger");
const AdFreePass = require("../models/AdFreePass");
const paymentService = require("./payment.service");
const {
  AD_REWARD_TIERS,
  REWARD_POLICY,
  PAID_AD_FREE,
  getRewardTier,
} = require("../config/adRewardTiers");

const PLAN_ORDER = ["none", "mobile", "basic", "standard", "premium"];

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function getActiveBaseDate(existingDate) {
  const now = new Date();
  if (existingDate && new Date(existingDate) > now) return new Date(existingDate);
  return now;
}

class RewardService {
  async getStatus(userId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    const history = await RewardLedger.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      coins: user.rewardCoins || 0,
      adFreeUntil: user.adFreeUntil || null,
      isAdFreeActive: Boolean(user.adFreeUntil && new Date(user.adFreeUntil) > new Date()),
      subscriptionPlan: user.subscriptionPlan,
      subscriptionExpiry: user.subscriptionExpiry,
      rewards: AD_REWARD_TIERS,
      policy: REWARD_POLICY,
      paidAdFree: PAID_AD_FREE,
      history,
    };
  }

  async earnFromAd({ userId, coins = 1, source = "rewarded_ad" }) {
    const amount = Number(coins) >= 2 ? 2 : 1;
    const user = await User.findByIdAndUpdate(
      userId,
      { $inc: { rewardCoins: amount } },
      { new: true }
    );
    if (!user) throw { status: 404, message: "User not found" };

    await RewardLedger.create({
      userId,
      type: "earn",
      source,
      coins: amount,
      balanceAfter: user.rewardCoins || 0,
    });

    return this.getStatus(userId);
  }

  async redeem({ userId, rewardId }) {
    const tier = getRewardTier(rewardId);
    if (!tier) throw { status: 400, message: "Invalid reward" };

    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };
    if ((user.rewardCoins || 0) < tier.coins) {
      throw { status: 400, message: `You need ${tier.coins} coins to redeem ${tier.label}` };
    }

    user.rewardCoins = (user.rewardCoins || 0) - tier.coins;

    if (tier.kind === "ad_free") {
      const base = getActiveBaseDate(user.adFreeUntil);
      user.adFreeUntil = addDays(base, tier.days);
      await user.save();
    } else if (tier.kind === "plan") {
      const base = getActiveBaseDate(user.subscriptionExpiry);
      const expiry = addDays(base, tier.days);

      await Subscription.create({
        userId,
        plan: tier.plan,
        priceNaira: 0,
        paymentGateway: "paystack",
        transactionRef: `NP-ADREWARD-${nanoid(12).toUpperCase()}`,
        status: "active",
        startDate: new Date(),
        expiryDate: expiry,
        isReward: true,
      });

      const shouldUpgrade =
        !user.hasActiveSubscription() ||
        PLAN_ORDER.indexOf(tier.plan) >= PLAN_ORDER.indexOf(user.subscriptionPlan);

      user.rewardActive = true;
      user.rewardExpiry = expiry;
      if (shouldUpgrade) {
        user.subscriptionPlan = tier.plan;
        user.subscriptionExpiry = expiry;
        user.isSubscriptionActive = true;
      }
      await user.save();
    }

    await RewardLedger.create({
      userId,
      type: "redeem",
      source: tier.kind,
      coins: -tier.coins,
      balanceAfter: user.rewardCoins || 0,
      rewardId: tier.id,
      metadata: tier,
    });

    return this.getStatus(userId);
  }

  async initializePaidAdFree({ userId, days, gateway }) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };
    if (!user.email) {
      throw {
        status: 400,
        message: "Please add an email address to your profile before buying ad-free days.",
      };
    }

    const normalizedDays = Math.floor(Number(days));
    if (!Number.isFinite(normalizedDays) || normalizedDays < PAID_AD_FREE.minDays) {
      throw { status: 400, message: `Choose at least ${PAID_AD_FREE.minDays} day.` };
    }
    if (normalizedDays > PAID_AD_FREE.maxDays) {
      throw { status: 400, message: `You can buy up to ${PAID_AD_FREE.maxDays} days at once.` };
    }

    const amountNaira = normalizedDays * PAID_AD_FREE.pricePerDayNaira;
    const transactionRef = `NP-ADFREE-${nanoid(14).toUpperCase()}`;

    await AdFreePass.create({
      userId,
      days: normalizedDays,
      pricePerDayNaira: PAID_AD_FREE.pricePerDayNaira,
      amountNaira,
      paymentGateway: gateway,
      transactionRef,
      status: "pending",
    });

    const paymentData = await paymentService.initializePayment({
      gateway,
      email: user.email,
      amountNaira,
      planId: `ad-free-${normalizedDays}-days`,
      userId,
      transactionRef,
    });

    return {
      paymentUrl: paymentData.paymentUrl,
      transactionRef,
      gateway,
      days: normalizedDays,
      pricePerDayNaira: PAID_AD_FREE.pricePerDayNaira,
      amountNaira,
    };
  }

  async verifyPaidAdFree({ transactionRef, gateway }) {
    const pass = await AdFreePass.findOne({ transactionRef });
    if (!pass) throw { status: 404, message: "Ad-free pass payment record not found" };
    if (pass.status === "active") {
      return { message: "Ad-free pass already active", pass, status: await this.getStatus(pass.userId) };
    }
    if (pass.status === "failed") {
      throw { status: 400, message: "This ad-free payment has already failed" };
    }

    const verification = await paymentService.verifyPayment({ gateway, transactionRef });
    if (!verification.verified) {
      await AdFreePass.findByIdAndUpdate(pass._id, { status: "failed" });
      throw { status: 400, message: "Payment verification failed. Please try again." };
    }

    const paidAmountKobo = Math.round(Number(verification.amount) * 100);
    const requiredAmountKobo = Math.round(Number(pass.amountNaira) * 100);
    if (!Number.isFinite(paidAmountKobo) || paidAmountKobo < requiredAmountKobo) {
      await AdFreePass.findByIdAndUpdate(pass._id, { status: "failed" });
      throw { status: 400, message: "Payment amount is lower than the ad-free package price." };
    }

    const user = await User.findById(pass.userId);
    if (!user) throw { status: 404, message: "User not found" };

    const now = new Date();
    const expiry = addDays(getActiveBaseDate(user.adFreeUntil), pass.days);

    pass.status = "active";
    pass.gatewayTransactionId = verification.gatewayTransactionId;
    pass.startDate = now;
    pass.expiryDate = expiry;
    await pass.save();

    user.adFreeUntil = expiry;
    await user.save();

    const status = await this.getStatus(user._id);
    return {
      message: "Ad-free package activated successfully",
      pass,
      expiryDate: expiry,
      status,
    };
  }
}

module.exports = new RewardService();

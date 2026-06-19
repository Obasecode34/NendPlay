// src/services/ad.service.js
//
// All ad business logic.
//
// Key rules enforced here:
//   1. Advertiser submits ad → gets price quote → pays → ad goes live
//   2. Subscribed users never see ads EXCEPT on live events
//   3. Live event ads are overlays/banners — they do NOT interrupt the stream
//   4. Google AdMob is frontend-only — backend just sends isSubscribed flag
//   5. Unsubscribed users see both native NendPlay ads AND AdMob

const Ad = require("../models/Ad");
const User = require("../models/User");
const paymentService = require("./payment.service");
const cloudinaryService = require("./cloudinary.service");
const { calculateAdPrice } = require("../config/adPricing");
const { nanoid } = require("nanoid");

const AD_TYPES = ["banner", "video", "overlay"];
const PLACEMENTS = [
  "home",
  "media",
  "news",
  "downloads",
  "profile",
  "subscription",
  "live_event",
  "novels",
  "shorts",
  "all",
];

async function uploadCreativeFile(creativeFile) {
  if (!creativeFile) return { creativeUrl: "", creativePublicId: null };
  const isVideo = creativeFile.mimetype.startsWith("video/");
  const uploaded = await cloudinaryService.uploadAdCreative(creativeFile.buffer, {
    resourceType: isVideo ? "video" : "image",
  });
  return {
    creativeUrl: uploaded.secure_url,
    creativePublicId: uploaded.public_id,
  };
}

class AdService {
  // ── Get price quote for an ad ─────────────────────────────────────────
  getAdPriceQuote({ adType, placement, durationDays }) {
    if (!adType) throw { status: 400, message: "adType is required" };
    if (!placement) throw { status: 400, message: "placement is required" };
    if (!durationDays || durationDays < 1) {
      throw { status: 400, message: "durationDays must be at least 1" };
    }

    const totalNaira = calculateAdPrice(adType, placement, durationDays);

    return {
      adType,
      placement,
      durationDays,
      totalNaira,
      breakdown: `NGN ${totalNaira.toLocaleString()} for ${durationDays} day(s)`,
    };
  }

  // ── Submit ad and initialize payment ─────────────────────────────────
  async submitAd({ userId, body, creativeFile }) {
    const {
      advertiserName,
      title,
      description,
      mediaUrl,
      targetUrl,
      adType,
      placement,
      durationDays,
      gateway,
    } = body;

    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    if (!advertiserName || !String(advertiserName).trim()) {
      throw { status: 400, message: "advertiserName is required" };
    }
    if (!title || !String(title).trim()) {
      throw { status: 400, message: "title is required" };
    }
    if (!AD_TYPES.includes(adType)) {
      throw { status: 400, message: "Invalid adType. Choose banner, video, or overlay." };
    }
    if (!PLACEMENTS.includes(placement)) {
      throw { status: 400, message: "Invalid placement." };
    }

    const parsedDurationDays = parseInt(durationDays, 10);
    if (!parsedDurationDays || parsedDurationDays < 1 || parsedDurationDays > 365) {
      throw { status: 400, message: "durationDays must be between 1 and 365" };
    }

    if (!user.email) {
      throw {
        status: 400,
        message: "Please add an email to your profile before advertising.",
      };
    }

    // Calculate price
    const priceNaira = calculateAdPrice(adType, placement, parsedDurationDays);

    // For live event ads — force targetAudience to "all"
    // (subscribers also see live event ads)
    const targetAudience = placement === "live_event" ? "all" : "unsubscribed";

    // Generate transaction ref
    const transactionRef = `NP-AD-${nanoid(16).toUpperCase()}`;

    const uploadedCreative = await uploadCreativeFile(creativeFile);
    const creativeUrl = uploadedCreative.creativeUrl || mediaUrl || "";
    const creativePublicId = uploadedCreative.creativePublicId;

    // Create ad record (pending payment)
    const ad = await Ad.create({
      advertiserId: userId,
      advertiserName: String(advertiserName).trim(),
      title: String(title).trim(),
      description: description || "",
      mediaUrl: creativeUrl,
      cloudinaryPublicId: creativePublicId,
      targetUrl: targetUrl || "",
      adType,
      placement,
      targetAudience,
      priceNaira,
      paymentGateway: gateway || "paystack",
      transactionRef,
      durationDays: parsedDurationDays,
      status: "pending_payment",
    });

    // Initialize payment
    const paymentData = await paymentService.initializePayment({
      gateway: gateway || "paystack",
      email: user.email,
      amountNaira: priceNaira,
      planId: `ad_${adType}`,
      userId,
      transactionRef,
      callbackPath: "/advertise",
      title: "NendPlay Ad Campaign",
      description: `${adType} ad on ${placement}`,
    });

    return {
      ad,
      paymentUrl: paymentData.paymentUrl,
      transactionRef,
      priceNaira,
    };
  }

  async createAdminAd({ adminId, body, creativeFile }) {
    const {
      advertiserName,
      title,
      description,
      mediaUrl,
      targetUrl,
      adType,
      placement,
      durationDays,
      targetAudience,
      status,
    } = body;

    if (!advertiserName || !String(advertiserName).trim()) {
      throw { status: 400, message: "advertiserName is required" };
    }
    if (!title || !String(title).trim()) {
      throw { status: 400, message: "title is required" };
    }
    if (!AD_TYPES.includes(adType)) {
      throw { status: 400, message: "Invalid adType. Choose banner, video, or overlay." };
    }
    if (!PLACEMENTS.includes(placement)) {
      throw { status: 400, message: "Invalid placement." };
    }

    const parsedDurationDays = parseInt(durationDays, 10);
    if (!parsedDurationDays || parsedDurationDays < 1 || parsedDurationDays > 365) {
      throw { status: 400, message: "durationDays must be between 1 and 365" };
    }

    const uploadedCreative = await uploadCreativeFile(creativeFile);
    const creativeUrl = uploadedCreative.creativeUrl || mediaUrl || "";
    const now = new Date();
    const normalizedStatus = ["active", "pending_review", "paused", "rejected"].includes(status)
      ? status
      : "active";
    const shouldSetDates = ["active", "paused"].includes(normalizedStatus);

    return Ad.create({
      advertiserId: adminId,
      advertiserName: String(advertiserName).trim(),
      title: String(title).trim(),
      description: description || "",
      mediaUrl: creativeUrl,
      cloudinaryPublicId: uploadedCreative.creativePublicId,
      targetUrl: targetUrl || "",
      adType,
      placement,
      targetAudience: targetAudience === "all" || placement === "live_event" ? "all" : "unsubscribed",
      priceNaira: calculateAdPrice(adType, placement, parsedDurationDays),
      paymentGateway: "paystack",
      isPaid: true,
      paidAt: now,
      transactionRef: `NP-ADMIN-AD-${nanoid(16).toUpperCase()}`,
      durationDays: parsedDurationDays,
      startDate: shouldSetDates ? now : null,
      expiryDate: shouldSetDates ? new Date(now.getTime() + parsedDurationDays * 24 * 60 * 60 * 1000) : null,
      status: normalizedStatus,
    });
  }

  // ── Verify ad payment and activate ───────────────────────────────────
  async verifyAdPayment({ transactionRef, gateway }) {
    const ad = await Ad.findOne({ transactionRef });
    if (!ad) throw { status: 404, message: "Ad record not found" };

    if (ad.status !== "pending_payment") {
      return { message: "Ad payment already processed", ad };
    }

    if (ad.paymentGateway !== gateway) {
      throw { status: 400, message: `This ad payment must be verified with ${ad.paymentGateway}.` };
    }

    // Verify with gateway
    const verification = await paymentService.verifyPayment({
      gateway,
      transactionRef,
    });

    if (!verification.verified) {
      await Ad.findByIdAndUpdate(ad._id, { status: "pending_payment" });
      throw { status: 400, message: "Payment verification failed. Please try again." };
    }

    if (Number(verification.amount) < Number(ad.priceNaira)) {
      throw { status: 400, message: "Payment amount is less than the ad price." };
    }

    const now = new Date();

    await Ad.findByIdAndUpdate(ad._id, {
      isPaid: true,
      paidAt: now,
      gatewayTransactionId: verification.gatewayTransactionId,
      status: "pending_review",
    });

    const updatedAd = await Ad.findById(ad._id);
    return {
      message: "Ad payment confirmed. Your ad is pending review.",
      ad: updatedAd,
    };
  }

  // ── Get ads to serve for a given context ─────────────────────────────
  // This is the core serving logic.
  // Returns the right ads based on:
  //   - isSubscribed: whether the user has an active subscription
  //   - placement: where on the app the request is coming from
  //   - isLiveEvent: whether this is a live event context
  async getAdsForContext({ isSubscribed, placement, isLiveEvent = false, limit = 3 }) {
    const now = new Date();
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 3, 1), 10);

    // Build query for active, non-expired ads
    const baseQuery = {
      status: "active",
      $or: [
        { expiryDate: { $gt: now } },
        { expiryDate: null },
        { expiryDate: { $exists: false } },
      ],
    };

    // Live event context:
    // - Always return native ads (both subscribers and non-subscribers see them)
    // - These are overlay/banner ads that don't interrupt the stream
    if (isLiveEvent || placement === "live_event") {
      const liveAds = await Ad.aggregate([
        { $match: {
        ...baseQuery,
        placement: { $in: ["live_event", "all"] },
        } },
        { $sample: { size: safeLimit } },
      ]);

      return {
        nativeAds: liveAds,
        showAdMob: false, // AdMob never shown during live events
        isLiveEvent: true,
        adNote: "Ads shown as non-interrupting overlays/banners alongside the stream",
      };
    }

    // Subscribed users: no ads (except live events handled above)
    if (isSubscribed) {
      return {
        nativeAds: [],
        showAdMob: false,
        isLiveEvent: false,
        adNote: "No ads for subscribed users",
      };
    }

    // Unsubscribed users: native NendPlay ads + AdMob
    const nativeAds = await Ad.aggregate([
      { $match: {
      ...baseQuery,
      placement: { $in: [placement, "all"] },
      targetAudience: { $in: ["unsubscribed", "all"] },
      } },
      { $sample: { size: safeLimit } },
    ]);

    return {
      nativeAds,
      showAdMob: true, // Frontend loads AdMob SDK when this is true
      isLiveEvent: false,
      adNote: "Native ads + Google AdMob for unsubscribed users",
    };
  }

  // ── Record impression ─────────────────────────────────────────────────
  async recordImpression(adId) {
    await Ad.findByIdAndUpdate(adId, { $inc: { impressions: 1 } });
  }

  // ── Record click ──────────────────────────────────────────────────────
  async recordClick(adId) {
    await Ad.findByIdAndUpdate(adId, { $inc: { clicks: 1 } });
    const ad = await Ad.findById(adId);
    if (!ad) throw { status: 404, message: "Ad not found" };
    return { targetUrl: ad.targetUrl };
  }

  // ── Get advertiser's own ads ──────────────────────────────────────────
  async getMyAds(userId, page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [ads, total] = await Promise.all([
      Ad.find({ advertiserId: userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Ad.countDocuments({ advertiserId: userId }),
    ]);

    return {
      ads,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get single ad ─────────────────────────────────────────────────────
  async getAdById(adId) {
    const ad = await Ad.findById(adId).populate(
      "advertiserId",
      "profileName username"
    );
    if (!ad) throw { status: 404, message: "Ad not found" };
    return ad;
  }

  // ── Pause / Resume ad ─────────────────────────────────────────────────
  async toggleAdStatus(adId, userId) {
    const ad = await Ad.findById(adId);
    if (!ad) throw { status: 404, message: "Ad not found" };

    if (ad.advertiserId.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only manage your own ads" };
    }

    if (!["active", "paused"].includes(ad.status)) {
      throw {
        status: 400,
        message: `Cannot toggle ad with status: ${ad.status}`,
      };
    }

    const newStatus = ad.status === "active" ? "paused" : "active";
    await Ad.findByIdAndUpdate(adId, { status: newStatus });

    return { message: `Ad ${newStatus}`, status: newStatus };
  }

  // ── Get ad analytics ──────────────────────────────────────────────────
  async getAdAnalytics(adId, userId) {
    const ad = await Ad.findById(adId);
    if (!ad) throw { status: 404, message: "Ad not found" };

    if (ad.advertiserId.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only view analytics for your own ads" };
    }

    const ctr =
      ad.impressions > 0
        ? ((ad.clicks / ad.impressions) * 100).toFixed(2)
        : "0.00";

    return {
      adId: ad._id,
      title: ad.title,
      status: ad.status,
      impressions: ad.impressions,
      clicks: ad.clicks,
      ctr: `${ctr}%`, // Click-through rate
      startDate: ad.startDate,
      expiryDate: ad.expiryDate,
      daysRemaining: ad.expiryDate
        ? Math.max(
            0,
            Math.ceil(
              (new Date(ad.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)
            )
          )
        : 0,
    };
  }

  // ── Auto-expire ads (called by a scheduled job) ───────────────────────
  async expireOldAds() {
    const now = new Date();
    const result = await Ad.updateMany(
      { status: "active", expiryDate: { $lt: now } },
      { status: "expired" }
    );
    return { expired: result.modifiedCount };
  }
}

module.exports = new AdService();

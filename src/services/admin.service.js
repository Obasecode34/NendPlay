const User = require("../models/User");
const Media = require("../models/Media");
const Document = require("../models/Document");
const Ad = require("../models/Ad");
const Subscription = require("../models/Subscription");
const Download = require("../models/Download");
const Referral = require("../models/Referral");
const RewardLedger = require("../models/RewardLedger");
const AdFreePass = require("../models/AdFreePass");
const Token = require("../models/Token");
const PushToken = require("../models/PushToken");
const cloudinaryService = require("./cloudinary.service");
const emailService = require("./email.service");
const bunnyService = require("./bunny.service");
const muxService = require("./mux.service");
const mediaThumbnailService = require("./mediaThumbnail.service");
const { ADMIN_PERMISSIONS } = require("../config/adminPermissions");

const PAGE_LIMIT_MAX = 100;
const PLAN_ORDER = ["none", "mobile", "basic", "standard", "premium"];

function pageParams(query) {
  const page = Math.max(parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(query.limit, 10) || 25, 1), PAGE_LIMIT_MAX);
  return { page, limit, skip: (page - 1) * limit };
}

function escapeRegex(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pagination(page, limit, total) {
  return {
    page,
    limit,
    total,
    pages: Math.max(Math.ceil(total / limit), 1),
  };
}

function pickAllowed(body, allowed) {
  return allowed.reduce((next, key) => {
    if (body[key] !== undefined) next[key] = body[key];
    return next;
  }, {});
}

function parseList(value, maxItems = null) {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) {
    const next = value.map((item) => `${item}`.trim()).filter(Boolean);
    return maxItems ? next.slice(0, maxItems) : next;
  }
  const raw = `${value}`.trim();
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parseList(parsed, maxItems);
  } catch {}
  const next = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return maxItems ? next.slice(0, maxItems) : next;
}

function firstListValue(values, fallback = "general") {
  return values?.[0] || fallback;
}

function parseNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) && next >= 0 ? next : null;
}

function slugifyTitle(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function getBunnyVideoId(video = {}) {
  return video.guid || video.id || video.videoLibraryId || video.videoId || "";
}

class AdminService {
  assertSuperAdmin(admin) {
    if (admin?.role !== "super_admin") {
      throw { status: 403, message: "Super admin access required" };
    }
  }

  getPermissions() {
    return ADMIN_PERMISSIONS;
  }

  async getDashboard() {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const [
      totalUsers,
      activeUsers,
      adminUsers,
      totalMedia,
      publishedMedia,
      pendingMedia,
      totalDocuments,
      totalAds,
      pendingAds,
      activeSubscriptions,
      downloads,
      referrals,
      rewardEvents,
      subscriptionRevenue,
      adRevenue,
      adFreeRevenue,
      recentUsers,
      pendingReviewAds,
      recentMedia,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isActive: true }),
      User.countDocuments({ role: { $in: ["admin", "super_admin"] } }),
      Media.countDocuments(),
      Media.countDocuments({ isActive: true, publishStatus: "published" }),
      Media.countDocuments({ isActive: true, publishStatus: "pending_review" }),
      Document.countDocuments(),
      Ad.countDocuments(),
      Ad.countDocuments({ status: "pending_review" }),
      Subscription.countDocuments({ status: "active", expiryDate: { $gt: now } }),
      Download.countDocuments({ status: "completed" }),
      Referral.countDocuments(),
      RewardLedger.countDocuments(),
      Subscription.aggregate([
        { $match: { status: "active", isReward: { $ne: true } } },
        { $group: { _id: null, total: { $sum: "$priceNaira" } } },
      ]),
      Ad.aggregate([
        { $match: { isPaid: true } },
        { $group: { _id: null, total: { $sum: "$priceNaira" } } },
      ]),
      AdFreePass.aggregate([
        { $match: { status: "active" } },
        { $group: { _id: null, total: { $sum: "$amountNaira" } } },
      ]),
      User.find().sort({ createdAt: -1 }).limit(6).select("profileName username email role isActive createdAt").lean(),
      Ad.find({ status: "pending_review" }).sort({ createdAt: -1 }).limit(6).populate("advertiserId", "profileName username email").lean(),
      Media.find().sort({ createdAt: -1 }).limit(6).select("title type publishStatus isActive viewCount createdAt").lean(),
    ]);

    return {
      stats: {
        totalUsers,
        activeUsers,
        adminUsers,
        totalMedia,
        publishedMedia,
        pendingMedia,
        totalDocuments,
        totalAds,
        pendingAds,
        activeSubscriptions,
        downloads,
        referrals,
        rewardEvents,
        revenueNaira:
          (subscriptionRevenue[0]?.total || 0) +
          (adRevenue[0]?.total || 0) +
          (adFreeRevenue[0]?.total || 0),
        today,
      },
      recentUsers,
      pendingReviewAds,
      recentMedia,
      permissions: ADMIN_PERMISSIONS,
    };
  }

  async listUsers(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.role) filter.role = query.role;
    if (query.status === "active") filter.isActive = true;
    if (query.status === "inactive") filter.isActive = false;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ profileName: search }, { username: search }, { email: search }, { referralCode: search }];
    }

    const [items, total] = await Promise.all([
      User.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select("-password")
        .lean(),
      User.countDocuments(filter),
    ]);

    return { users: items, pagination: pagination(page, limit, total) };
  }

  async getUserDetails(userId, admin) {
    this.assertSuperAdmin(admin);

    const user = await User.findById(userId).select("-password -passwordResetTokenHash").lean();
    if (!user) throw { status: 404, message: "User not found" };

    const [
      mediaCount,
      documentCount,
      downloadCount,
      subscriptionCount,
      rewardCount,
      referralCount,
      activeTokens,
      pushTokens,
      recentMedia,
      recentDocuments,
      recentSubscriptions,
      recentDownloads,
      recentRewards,
    ] = await Promise.all([
      Media.countDocuments({ uploadedBy: userId }),
      Document.countDocuments({ uploadedBy: userId }),
      Download.countDocuments({ userId }),
      Subscription.countDocuments({ userId }),
      RewardLedger.countDocuments({ userId }),
      Referral.countDocuments({ $or: [{ referrerId: userId }, { referredUserId: userId }] }),
      Token.countDocuments({ userId }),
      PushToken.find({ userId }).sort({ updatedAt: -1 }).limit(10).lean(),
      Media.find({ uploadedBy: userId }).sort({ createdAt: -1 }).limit(10).select("title type publishStatus isActive viewCount createdAt").lean(),
      Document.find({ uploadedBy: userId }).sort({ createdAt: -1 }).limit(10).select("title fileType genre isActive downloadCount createdAt").lean(),
      Subscription.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      Download.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
      RewardLedger.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    return {
      user,
      stats: {
        mediaCount,
        documentCount,
        downloadCount,
        subscriptionCount,
        rewardCount,
        referralCount,
        activeTokens,
        pushTokenCount: pushTokens.length,
      },
      pushTokens,
      recentMedia,
      recentDocuments,
      recentSubscriptions,
      recentDownloads,
      recentRewards,
    };
  }

  async updateUser(userId, body, admin) {
    const target = await User.findById(userId);
    if (!target) throw { status: 404, message: "User not found" };
    if (target.role === "super_admin" && admin.role !== "super_admin") {
      throw { status: 403, message: "Only a super admin can edit another super admin" };
    }

    const updates = pickAllowed(body, [
      "isActive",
      "role",
      "adminPermissions",
      "subscriptionPlan",
      "subscriptionExpiry",
      "adFreeUntil",
      "rewardCoins",
    ]);

    if (updates.role && admin.role !== "super_admin") {
      throw { status: 403, message: "Only a super admin can change admin roles" };
    }
    if (updates.adminPermissions && admin.role !== "super_admin") {
      throw { status: 403, message: "Only a super admin can change admin permissions" };
    }
    if (updates.adminPermissions) {
      updates.adminPermissions = updates.adminPermissions.filter((permission) => ADMIN_PERMISSIONS.includes(permission));
    }
    if (updates.subscriptionPlan && !PLAN_ORDER.includes(updates.subscriptionPlan)) {
      throw { status: 400, message: "Invalid subscription plan" };
    }
    if (updates.subscriptionExpiry !== undefined) {
      updates.subscriptionExpiry = updates.subscriptionExpiry ? new Date(updates.subscriptionExpiry) : null;
      updates.isSubscriptionActive = Boolean(
        updates.subscriptionPlan &&
        updates.subscriptionPlan !== "none" &&
        updates.subscriptionExpiry &&
        updates.subscriptionExpiry > new Date()
      );
    }
    if (updates.adFreeUntil !== undefined) {
      updates.adFreeUntil = updates.adFreeUntil ? new Date(updates.adFreeUntil) : null;
    }

    Object.assign(target, updates);
    await target.save();
    return target.toPublicProfile();
  }

  async sendUserEmail(userId, { subject, message }, admin) {
    const target = await User.findById(userId).select("profileName username email isActive");
    if (!target) throw { status: 404, message: "User not found" };
    if (!target.email) throw { status: 400, message: "This user does not have an email address" };

    const cleanSubject = String(subject || "").trim();
    const cleanMessage = String(message || "").trim();

    if (!cleanSubject) throw { status: 400, message: "Email subject is required" };
    if (!cleanMessage) throw { status: 400, message: "Email message is required" };
    if (cleanSubject.length > 150) throw { status: 400, message: "Email subject cannot exceed 150 characters" };
    if (cleanMessage.length > 5000) throw { status: 400, message: "Email message cannot exceed 5000 characters" };

    const displayName = target.profileName || target.username || "NendPlay user";
    const text = [
      `Hello ${displayName},`,
      "",
      cleanMessage,
      "",
      "Regards,",
      "NendPlay Media Team",
    ].join("\n");

    const sent = await emailService.sendEmail({
      to: target.email,
      subject: cleanSubject,
      text,
    });

    return {
      userId,
      to: target.email,
      subject: cleanSubject,
      sent,
      sentBy: admin?.id,
    };
  }

  async deleteUser(userId, admin) {
    this.assertSuperAdmin(admin);

    if (String(admin.id) === String(userId)) {
      throw { status: 400, message: "You cannot delete your own super admin account" };
    }

    const target = await User.findById(userId);
    if (!target) throw { status: 404, message: "User not found" };

    if (target.role === "super_admin") {
      const superAdminCount = await User.countDocuments({ role: "super_admin", isActive: true });
      if (superAdminCount <= 1) {
        throw { status: 400, message: "Cannot delete the last active super admin" };
      }
    }

    await Promise.all([
      Token.deleteMany({ userId }),
      PushToken.deleteMany({ userId }),
      User.updateMany({}, { $pull: { savedMedia: { $in: await Media.find({ uploadedBy: userId }).distinct("_id") }, subscribedCreators: userId } }),
      Referral.deleteMany({ $or: [{ referrerId: userId }, { referredUserId: userId }] }),
      AdFreePass.deleteMany({ userId }),
      Download.deleteMany({ userId }),
      Subscription.deleteMany({ userId }),
      RewardLedger.deleteMany({ userId }),
      Ad.deleteMany({ advertiserId: userId }),
    ]);

    await User.findByIdAndDelete(userId);

    return { deletedUserId: userId };
  }

  async listMedia(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.type) filter.type = query.type;
    if (query.publishStatus) filter.publishStatus = query.publishStatus;
    if (query.status === "active") filter.isActive = true;
    if (query.status === "inactive") filter.isActive = false;
    if (["draft", "processing", "pending_review", "published", "rejected", "failed", "archived"].includes(query.status)) {
      filter.publishStatus = query.status;
    }
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [
        { title: search },
        { description: search },
        { category: search },
        { categories: search },
        { navigationLabels: search },
        { homeSections: search },
        { genre: search },
        { genres: search },
        { parentTitle: search },
        { episodeTitle: search },
        { licenseType: search },
        { sourceName: search },
        { attributionText: search },
      ];
    }

    const [items, total] = await Promise.all([
      Media.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("uploadedBy", "profileName username email").lean(),
      Media.countDocuments(filter),
    ]);

    return { media: items, pagination: pagination(page, limit, total) };
  }

  async updateMedia(mediaId, body, admin = null, files = {}) {
    const updates = pickAllowed(body, [
      "title",
      "description",
      "category",
      "categories",
      "navigationLabels",
      "genre",
      "genres",
      "language",
      "country",
      "contentRating",
      "releaseStatus",
      "publishStatus",
      "homeSections",
      "isFeatured",
      "featuredRank",
      "availabilityCountries",
      "isLocked",
      "isShort",
      "isActive",
      "collectionType",
      "parentTitle",
      "seasonNumber",
      "episodeNumber",
      "partNumber",
      "episodeTitle",
      "licenseType",
      "licenseUrl",
      "sourceUrl",
      "sourceName",
      "attributionText",
      "rightsSummary",
      "requiresAttribution",
      "isRightsVerified",
      "rightsVerifiedAt",
      "reviewStatus",
      "reviewNote",
      "thumbnailUrl",
    ]);

    if (updates.type === "shorts") updates.type = "short";
    if (updates.type === "short") updates.isShort = true;
    if (updates.type && updates.type !== "short" && body.isShort === undefined) updates.isShort = false;
    if (updates.isShort !== undefined) {
      updates.isShort = updates.isShort === true || updates.isShort === "true";
      if (updates.isShort) updates.type = "short";
    }

    if (updates.categories !== undefined) {
      updates.categories = parseList(updates.categories, 5);
      updates.category = firstListValue(updates.categories, updates.category || body.category || "general");
    }
    if (updates.navigationLabels !== undefined) {
      updates.navigationLabels = parseList(updates.navigationLabels, 5);
      updates.homeSections = updates.navigationLabels;
    }
    if (updates.genres !== undefined) {
      updates.genres = parseList(updates.genres, 5);
      updates.genre = updates.genres[0] || updates.genre || body.genre || "";
    } else if (updates.genre !== undefined && !Array.isArray(updates.genre)) {
      const parsedGenre = parseList(updates.genre, 5);
      updates.genres = parsedGenre;
      updates.genre = parsedGenre[0] || updates.genre || "";
    }
    if (updates.homeSections !== undefined) updates.homeSections = parseList(updates.homeSections, 5);
    if (updates.availabilityCountries !== undefined) updates.availabilityCountries = parseList(updates.availabilityCountries);
    if (updates.collectionType !== undefined && !["single", "movie_part", "series_episode"].includes(updates.collectionType)) {
      updates.collectionType = "single";
    }
    if (updates.parentTitle !== undefined || updates.collectionType !== undefined) {
      updates.parentTitleSlug = updates.parentTitle ? slugifyTitle(updates.parentTitle) : "";
    }
    if (updates.seasonNumber !== undefined) updates.seasonNumber = parseNumber(updates.seasonNumber);
    if (updates.episodeNumber !== undefined) updates.episodeNumber = parseNumber(updates.episodeNumber);
    if (updates.partNumber !== undefined) updates.partNumber = parseNumber(updates.partNumber);
    if (updates.collectionType === "single") {
      updates.parentTitle = "";
      updates.parentTitleSlug = "";
      updates.seasonNumber = null;
      updates.episodeNumber = null;
      updates.partNumber = null;
      updates.episodeTitle = "";
    } else if (updates.collectionType === "movie_part") {
      updates.seasonNumber = null;
      updates.episodeNumber = null;
    } else if (updates.collectionType === "series_episode") {
      updates.partNumber = null;
    }

    const thumbnailFile = files?.thumbnail?.[0] || files?.thumbnail || null;
    if (thumbnailFile) {
      const existing = await Media.findById(mediaId).select("thumbnailCloudinaryId");
      if (!existing) throw { status: 404, message: "Media not found" };
      const thumbResult = await cloudinaryService.uploadThumbnail(thumbnailFile.buffer, {
        folder: "nendplay/thumbnails",
      });
      if (existing.thumbnailCloudinaryId) {
        cloudinaryService.deleteFile(existing.thumbnailCloudinaryId, "image");
      }
      updates.thumbnailUrl = thumbResult.secure_url;
      updates.thumbnailCloudinaryId = thumbResult.public_id;
    }

    if (updates.publishStatus === "published") {
      updates.reviewStatus = "approved";
      updates.reviewedAt = new Date();
      updates.reviewedBy = admin?.id || null;
    }
    if (updates.publishStatus === "rejected") {
      updates.reviewStatus = "rejected";
      updates.reviewedAt = new Date();
      updates.reviewedBy = admin?.id || null;
      updates.isActive = false;
    }
    if (updates.publishStatus === "pending_review") {
      updates.reviewStatus = "pending";
      updates.reviewedAt = null;
      updates.reviewedBy = null;
      updates.isActive = true;
    }

    let media = await Media.findByIdAndUpdate(mediaId, updates, { new: true });
    if (!media) throw { status: 404, message: "Media not found" };
    media = await this.refreshMediaPlaybackState(media);
    return media;
  }

  async refreshMediaPlaybackState(media) {
    if (!media?.storageProvider) return media;

    try {
      if (media.storageProvider === "bunny" && media.storageKey) {
        const video = await bunnyService.getVideo(media.storageKey);
        const playback = bunnyService.getPlayback(media.storageKey);
        media.duration = video.length || video.duration || media.duration;
        media.playbackUrl = playback.playbackUrl || media.playbackUrl;
        media.hlsUrl = playback.hlsUrl || media.hlsUrl;
        media.mediaUrl = playback.hlsUrl || media.mediaUrl;
        media.thumbnailUrl = media.thumbnailUrl || playback.thumbnailUrl || video.thumbnailUrl || "";
        media.processingStatus = bunnyService.getProcessingStatus(video);
        await mediaThumbnailService.ensureGeneratedThumbnail(media);
        await media.save();
      }

      if (media.storageProvider === "mux" && media.storageKey) {
        const asset = await muxService.getAsset(media.storageKey);
        const playback = muxService.getPlayback(asset.playback_ids || []);
        media.duration = asset.duration || media.duration;
        media.playbackUrl = playback.playbackUrl || media.playbackUrl;
        media.hlsUrl = playback.hlsUrl || media.hlsUrl;
        media.mediaUrl = playback.hlsUrl || media.mediaUrl;
        media.thumbnailUrl = media.thumbnailUrl || playback.thumbnailUrl || "";
        media.processingStatus = asset.status === "ready" ? "ready" : "processing";
        await mediaThumbnailService.ensureGeneratedThumbnail(media);
        await media.save();
      }
      if (media.storageProvider === "cloudinary") {
        await mediaThumbnailService.ensureGeneratedThumbnail(media);
      }
    } catch (err) {
      console.warn(`Media provider refresh skipped for ${media._id}: ${err.message}`);
    }

    return media;
  }

  async approveMedia(mediaId, admin) {
    let current = await Media.findById(mediaId);
    if (!current) throw { status: 404, message: "Media not found" };
    current = await this.refreshMediaPlaybackState(current);
    const readyForPlayback = ["ready", "uploaded"].includes(current.processingStatus || "ready");

    const media = await Media.findByIdAndUpdate(
      mediaId,
      {
        publishStatus: readyForPlayback ? "published" : "processing",
        reviewStatus: "approved",
        reviewNote: "",
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        isActive: true,
      },
      { new: true }
    );
    if (!media) throw { status: 404, message: "Media not found" };
    return media;
  }

  async syncBunnyLibrary(body = {}, admin) {
    const pageSize = Math.min(Math.max(parseInt(body.limit, 10) || 100, 1), 100);
    const maxPages = Math.min(Math.max(parseInt(body.maxPages, 10) || 5, 1), 25);
    const autoApprove = body.autoApprove === true || body.autoApprove === "true";
    const defaultType = body.type || "video";
    const defaultCategory = body.category || "bunny";
    const defaultHomeSections = Array.isArray(body.homeSections)
      ? body.homeSections
      : String(body.homeSections || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

    let page = 1;
    let imported = 0;
    let updated = 0;
    let skipped = 0;
    let totalSeen = 0;

    while (page <= maxPages) {
      const result = await bunnyService.listVideos({
        page,
        itemsPerPage: pageSize,
        search: body.search || "",
      });
      const videos = result.items || [];
      if (videos.length === 0) break;

      for (const video of videos) {
        totalSeen += 1;
        const videoId = getBunnyVideoId(video);
        if (!videoId) {
          skipped += 1;
          continue;
        }

        const playback = bunnyService.getPlayback(videoId);
        const processingStatus = bunnyService.getProcessingStatus(video);
        const isReady = processingStatus === "ready";
        const existing = await Media.findOne({ storageProvider: "bunny", storageKey: videoId });
        const approved = autoApprove || existing?.reviewStatus === "approved";
        const publishStatus = isReady
          ? (approved ? "published" : "pending_review")
          : processingStatus;

        const common = {
          title: video.title || video.name || existing?.title || `Bunny video ${videoId}`,
          description: existing?.description || "",
          type: existing?.type || defaultType,
          category: existing?.category || defaultCategory,
          categories: existing?.categories?.length ? existing.categories : [defaultCategory],
          navigationLabels: existing?.navigationLabels?.length ? existing.navigationLabels : defaultHomeSections.slice(0, 5),
          homeSections: existing?.homeSections?.length ? existing.homeSections : defaultHomeSections,
          mediaUrl: playback.hlsUrl || existing?.mediaUrl || `bunny://videos/${videoId}`,
          playbackUrl: playback.playbackUrl || existing?.playbackUrl || "",
          hlsUrl: playback.hlsUrl || existing?.hlsUrl || "",
          thumbnailUrl: existing?.thumbnailUrl || playback.thumbnailUrl || video.thumbnailUrl || "",
          duration: video.length || video.duration || existing?.duration || 0,
          fileSize: video.storageSize || video.size || existing?.fileSize || 0,
          mimeType: existing?.mimeType || "application/vnd.apple.mpegurl",
          storageProvider: "bunny",
          storageKey: videoId,
          transcodingProvider: "bunny",
          processingStatus,
          publishStatus,
          reviewStatus: approved ? "approved" : (existing?.reviewStatus || "pending"),
          reviewedBy: approved ? admin.id : (existing?.reviewedBy || null),
          reviewedAt: approved ? new Date() : (existing?.reviewedAt || null),
          isActive: true,
          isUserUpload: false,
          uploadedBy: existing?.uploadedBy || admin.id,
          licenseType: existing?.licenseType || "owned",
          sourceName: existing?.sourceName || "Bunny Stream",
          sourceUrl: existing?.sourceUrl || "",
          rightsSummary: existing?.rightsSummary || "Imported from the NendPlay Bunny Stream library.",
          isRightsVerified: existing?.isRightsVerified ?? autoApprove,
          rightsVerifiedAt: existing?.rightsVerifiedAt || (autoApprove ? new Date() : null),
        };

        if (existing) {
          Object.assign(existing, common);
          await mediaThumbnailService.ensureGeneratedThumbnail(existing);
          await existing.save();
          updated += 1;
        } else {
          const media = await Media.create(common);
          await mediaThumbnailService.ensureGeneratedThumbnail(media);
          imported += 1;
        }
      }

      const totalItems = Number(result.totalItems || 0);
      if (videos.length < pageSize || (totalItems && page * pageSize >= totalItems)) break;
      page += 1;
    }

    return {
      provider: "bunny",
      totalSeen,
      imported,
      updated,
      skipped,
      autoApprove,
      message: autoApprove
        ? "Bunny library synced and ready videos were published."
        : "Bunny library synced. Review imported videos in the Media tab.",
    };
  }

  async rejectMedia(mediaId, body, admin) {
    const note = String(body?.reviewNote || body?.reason || "").trim();
    const media = await Media.findByIdAndUpdate(
      mediaId,
      {
        publishStatus: "rejected",
        reviewStatus: "rejected",
        reviewNote: note,
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        isActive: false,
      },
      { new: true }
    );
    if (!media) throw { status: 404, message: "Media not found" };
    return media;
  }

  async deleteMedia(mediaId, admin) {
    this.assertSuperAdmin(admin);

    const media = await Media.findById(mediaId);
    if (!media) throw { status: 404, message: "Media not found" };

    if (media.cloudinaryPublicId) {
      await cloudinaryService.deleteFile(media.cloudinaryPublicId, "video");
    }
    if (media.thumbnailCloudinaryId) {
      await cloudinaryService.deleteFile(media.thumbnailCloudinaryId, "image");
    }
    if (media.storageProvider === "bunny" && media.storageKey) {
      try {
        await bunnyService.deleteVideo(media.storageKey);
      } catch (err) {
        console.warn(`Bunny video delete skipped for ${media.storageKey}: ${err.message}`);
      }
    }
    if (media.storageProvider === "mux" && media.storageKey) {
      try {
        await muxService.deleteAsset(media.storageKey);
      } catch (err) {
        console.warn(`Mux asset delete skipped for ${media.storageKey}: ${err.message}`);
      }
    }

    await Promise.all([
      User.updateMany({}, { $pull: { savedMedia: media._id } }),
      Download.deleteMany({ contentId: media._id, contentType: "media" }),
      Media.updateMany({ originalMedia: media._id }, { $set: { originalMedia: null } }),
      Media.findByIdAndDelete(media._id),
    ]);

    return { deletedMediaId: mediaId };
  }

  async listDocuments(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.fileType) filter.fileType = query.fileType;
    if (query.genre) filter.genre = query.genre;
    if (query.status === "active") filter.isActive = true;
    if (query.status === "inactive") filter.isActive = false;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [
        { title: search },
        { description: search },
        { category: search },
        { genre: search },
        { author: search },
        { licenseType: search },
        { sourceName: search },
        { attributionText: search },
      ];
    }

    const [items, total] = await Promise.all([
      Document.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("uploadedBy", "profileName username email").lean(),
      Document.countDocuments(filter),
    ]);

    return { documents: items, pagination: pagination(page, limit, total) };
  }

  async updateDocument(documentId, body) {
    const updates = pickAllowed(body, [
      "title",
      "description",
      "category",
      "genre",
      "tags",
      "author",
      "isActive",
      "licenseType",
      "licenseUrl",
      "sourceUrl",
      "sourceName",
      "attributionText",
      "rightsSummary",
      "requiresAttribution",
      "isRightsVerified",
      "rightsVerifiedAt",
    ]);
    const document = await Document.findByIdAndUpdate(documentId, updates, { new: true });
    if (!document) throw { status: 404, message: "Document not found" };
    return document;
  }

  async deleteDocument(documentId, admin) {
    this.assertSuperAdmin(admin);

    const document = await Document.findById(documentId);
    if (!document) throw { status: 404, message: "Document not found" };

    const sharedForkCount = await Document.countDocuments({
      _id: { $ne: document._id },
      cloudinaryPublicId: document.cloudinaryPublicId,
    });
    if (document.cloudinaryPublicId && sharedForkCount === 0) {
      await cloudinaryService.deleteFile(document.cloudinaryPublicId, "raw");
    }

    await Promise.all([
      Download.deleteMany({ contentId: document._id, contentType: "document" }),
      Document.updateMany({ originalDocument: document._id }, { $set: { originalDocument: null, isFork: false } }),
      Document.findByIdAndDelete(document._id),
    ]);

    return { deletedDocumentId: documentId };
  }

  async listAds(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.placement) filter.placement = query.placement;
    if (query.search) {
      const search = new RegExp(escapeRegex(query.search), "i");
      filter.$or = [{ title: search }, { advertiserName: search }, { description: search }];
    }

    const [items, total] = await Promise.all([
      Ad.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("advertiserId", "profileName username email").lean(),
      Ad.countDocuments(filter),
    ]);

    return { ads: items, pagination: pagination(page, limit, total) };
  }

  async updateAd(adId, body) {
    const updates = pickAllowed(body, ["status", "rejectionReason", "placement", "targetAudience", "durationDays"]);
    if (updates.status === "active") {
      const now = new Date();
      updates.startDate = now;
      updates.expiryDate = new Date(now.getTime() + (Number(body.durationDays) || 1) * 24 * 60 * 60 * 1000);
    }
    const ad = await Ad.findByIdAndUpdate(adId, updates, { new: true });
    if (!ad) throw { status: 404, message: "Ad not found" };
    return ad;
  }

  async listSubscriptions(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.plan) filter.plan = query.plan;
    const [items, total] = await Promise.all([
      Subscription.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "profileName username email").lean(),
      Subscription.countDocuments(filter),
    ]);
    return { subscriptions: items, pagination: pagination(page, limit, total) };
  }

  async listDownloads(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.status) filter.status = query.status;
    if (query.contentType) filter.contentType = query.contentType;
    const [items, total] = await Promise.all([
      Download.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "profileName username email").lean(),
      Download.countDocuments(filter),
    ]);
    return { downloads: items, pagination: pagination(page, limit, total) };
  }

  async listRewards(query) {
    const { page, limit, skip } = pageParams(query);
    const filter = {};
    if (query.type) filter.type = query.type;
    const [items, total] = await Promise.all([
      RewardLedger.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate("userId", "profileName username email").lean(),
      RewardLedger.countDocuments(filter),
    ]);
    return { rewards: items, pagination: pagination(page, limit, total) };
  }
}

module.exports = new AdminService();

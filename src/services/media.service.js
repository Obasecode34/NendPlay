// src/services/media.service.js
//
// All media business logic lives here.
// Upload → validate → store on Cloudinary → save to MongoDB.
//
// The Shorts duration check is enforced here:
// If isShort=true and duration > 180s, the upload is rejected.
// The duration comes from Cloudinary's upload result metadata.

const Media = require("../models/Media");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const cloudinaryService = require("./cloudinary.service");
const bunnyService = require("./bunny.service");
const muxService = require("./mux.service");
const {
  MAX_SHORT_DURATION_SECONDS,
  VIDEO_STORAGE_PROVIDER,
  VIDEO_FALLBACK_PROVIDER,
  DIRECT_UPLOAD_ENABLED,
  MAX_VIDEO_SIZE_MB,
  JWT_ACCESS_SECRET,
} = require("../config/env");
const { getMediaCategory } = require("../middleware/upload.middleware");

const parseList = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => `${item}`.trim()).filter(Boolean);
  return `${value}`.split(",").map((item) => item.trim()).filter(Boolean);
};

const parseBoolean = (value) => value === true || value === "true";
const isAdminUser = (user = {}) => ["admin", "super_admin"].includes(user.role);
const PLAYBACK_TOKEN_TTL_SECONDS = 10 * 60;

const publicPublishFilter = () => ({
  $or: [
    { publishStatus: "published" },
    { publishStatus: { $exists: false } },
    { publishStatus: null },
    { publishStatus: "" },
  ],
});

const isPublicMedia = (media) => (
  Boolean(media?.isActive) &&
  (!media.publishStatus || media.publishStatus === "published")
);

const LICENSE_TYPES = new Set([
  "unknown",
  "public_domain",
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
  "standard_license",
  "owned",
  "permission_granted",
]);

const ATTRIBUTION_LICENSES = new Set([
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
]);

const parseRightsMetadata = (body = {}) => {
  const licenseType = LICENSE_TYPES.has(body.licenseType) ? body.licenseType : "unknown";
  const requiresAttribution =
    body.requiresAttribution !== undefined
      ? parseBoolean(body.requiresAttribution)
      : ATTRIBUTION_LICENSES.has(licenseType);

  return {
    licenseType,
    licenseUrl: body.licenseUrl || "",
    sourceUrl: body.sourceUrl || "",
    sourceName: body.sourceName || "",
    attributionText: body.attributionText || "",
    rightsSummary: body.rightsSummary || "",
    requiresAttribution,
  };
};

class MediaService {
  getBestPlaybackUrl(media) {
    return media.hlsUrl || media.playbackUrl || media.mediaUrl || "";
  }

  async canUserAccessMedia(media, userId) {
    if (!media?.isLocked) return true;
    if (!userId) return false;
    const user = await User.findById(userId).select("subscriptionPlan subscriptionExpiry isActive");
    return Boolean(user?.isActive && user.hasActiveSubscription());
  }

  generatePlaybackToken(mediaId, userId = null) {
    return jwt.sign(
      {
        type: "playback",
        mediaId: String(mediaId),
        userId: userId ? String(userId) : null,
      },
      JWT_ACCESS_SECRET,
      { expiresIn: PLAYBACK_TOKEN_TTL_SECONDS }
    );
  }

  verifyPlaybackToken(token, mediaId) {
    if (!token) return null;
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      if (decoded.type !== "playback") return null;
      if (String(decoded.mediaId) !== String(mediaId)) return null;
      return decoded;
    } catch {
      return null;
    }
  }

  async getPlaybackManifest(mediaId, userId = null) {
    const media = await this.getMediaById(mediaId);
    const canPlay = await this.canUserAccessMedia(media, userId);
    const sourceUrl = this.getBestPlaybackUrl(media);

    if (!sourceUrl) {
      throw { status: 404, message: "Media playback URL not found" };
    }

    if (!canPlay) {
      return {
        canPlay: false,
        locked: true,
        requiresSubscription: true,
        media: {
          _id: media._id,
          title: media.title,
          description: media.description,
          thumbnailUrl: media.thumbnailUrl,
          type: media.type,
          duration: media.duration,
          isLocked: true,
          uploadedBy: media.uploadedBy,
          createdAt: media.createdAt,
        },
      };
    }

    const playbackToken = this.generatePlaybackToken(media._id, userId);
    const streamUrl = `/api/media/${media._id}/stream?playbackToken=${encodeURIComponent(playbackToken)}`;
    const isHls = sourceUrl.includes(".m3u8");

    return {
      canPlay: true,
      locked: false,
      streamUrl,
      sourceType: isHls ? "hls" : "file",
      mimeType: media.mimeType || (isHls ? "application/vnd.apple.mpegurl" : "video/mp4"),
      expiresIn: PLAYBACK_TOKEN_TTL_SECONDS,
      media,
    };
  }
  // ── Upload and create media ───────────────────────────────────────────
  getInitialReviewState(body = {}, user = {}) {
    const adminUpload = isAdminUser(user);
    const requestedStatus = body.publishStatus;

    if (adminUpload && requestedStatus) {
      return {
        publishStatus: requestedStatus,
        reviewStatus: requestedStatus === "published" ? "approved" : requestedStatus === "rejected" ? "rejected" : "pending",
        reviewedBy: requestedStatus === "published" || requestedStatus === "rejected" ? user.userId || user.id : null,
        reviewedAt: requestedStatus === "published" || requestedStatus === "rejected" ? new Date() : null,
      };
    }

    return {
      publishStatus: "pending_review",
      reviewStatus: "pending",
      reviewedBy: null,
      reviewedAt: null,
    };
  }

  // â”€â”€ Upload and create media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  async uploadMedia({ mediaFile, thumbnailFile, body, userId, user }) {
    const {
      title,
      description,
      type,
      category,
      tags,
      genre,
      language,
      country,
      contentRating,
      releaseStatus,
      publishStatus,
      homeSections,
      isFeatured,
      featuredRank,
      availabilityCountries,
      artist,
      releaseYear,
      isLocked,
      isShort,
      isLive,
      liveScheduledAt,
    } = body;

    // 1. Determine resource type for Cloudinary
    const mediaCategory = getMediaCategory(mediaFile.mimetype);
    const isVideoUpload = mediaCategory === "video";
    const directVideoProvider = ["bunny", "mux"].includes(VIDEO_STORAGE_PROVIDER);

    if (isVideoUpload && directVideoProvider && DIRECT_UPLOAD_ENABLED) {
      throw {
        status: 400,
        message: "Use /api/media/upload-session for video uploads. Videos are stored on Bunny Stream with Mux fallback, not uploaded through the API server.",
      };
    }

    const resourceType = "video"; // Cloudinary uses "video" for both video and audio

    // 2. Upload media file to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await cloudinaryService.uploadMedia(mediaFile.buffer, {
        folder: `nendplay/${mediaCategory}`,
        resourceType,
      });
    } catch (err) {
      throw { status: 500, message: `Media upload failed: ${err.message}` };
    }

    // 3. Get duration from Cloudinary result
    const duration = cloudinaryService.getDurationFromResult(cloudinaryResult);

    // 4. Enforce Shorts duration limit
    if (isShort === "true" || isShort === true || type === "short") {
      if (duration > MAX_SHORT_DURATION_SECONDS) {
        // Delete the uploaded file from Cloudinary — reject it
        await cloudinaryService.deleteFile(
          cloudinaryResult.public_id,
          resourceType
        );
        throw {
          status: 400,
          message: `Shorts cannot exceed 3 minutes. Your file is ${Math.ceil(duration / 60)} minutes long.`,
        };
      }
    }

    // 5. Upload thumbnail if provided
    let thumbnailUrl = "";
    let thumbnailCloudinaryId = null;

    if (thumbnailFile) {
      try {
        const thumbResult = await cloudinaryService.uploadThumbnail(
          thumbnailFile.buffer,
          { folder: "nendplay/thumbnails" }
        );
        thumbnailUrl = thumbResult.secure_url;
        thumbnailCloudinaryId = thumbResult.public_id;
      } catch (err) {
        console.error("Thumbnail upload failed:", err.message);
        // Non-fatal — media still saved without thumbnail
      }
    }

    // 6. Parse tags from string or array
    const parsedTags = parseList(tags);
    const parsedHomeSections = parseList(homeSections);
    const parsedAvailabilityCountries = parseList(availabilityCountries);
    const rightsMetadata = parseRightsMetadata(body);
    const reviewState = this.getInitialReviewState(body, user);

    // 7. Save to MongoDB
    const media = await Media.create({
      title,
      description: description || "",
      type: type || (isShort ? "short" : "video"),
      category: category || "general",
      tags: parsedTags,
      genre: genre || "",
      language: language || "",
      country: country || "",
      contentRating: contentRating || "",
      releaseStatus: releaseStatus || "released",
      publishStatus: reviewState.publishStatus,
      reviewStatus: reviewState.reviewStatus,
      reviewedBy: reviewState.reviewedBy,
      reviewedAt: reviewState.reviewedAt,
      homeSections: parsedHomeSections,
      isFeatured: parseBoolean(isFeatured),
      featuredRank: featuredRank ? parseInt(featuredRank) : 0,
      availabilityCountries: parsedAvailabilityCountries,
      ...rightsMetadata,
      artist: artist || "",
      releaseYear: releaseYear ? parseInt(releaseYear) : null,
      mediaUrl: cloudinaryResult.secure_url,
      playbackUrl: cloudinaryResult.secure_url,
      storageProvider: "cloudinary",
      transcodingProvider: "cloudinary",
      processingStatus: "ready",
      cloudinaryPublicId: cloudinaryResult.public_id,
      thumbnailUrl,
      thumbnailCloudinaryId,
      duration,
      fileSize: cloudinaryService.getFileSizeFromResult(cloudinaryResult),
      mimeType: mediaFile.mimetype,
      isLocked: parseBoolean(isLocked),
      isShort: parseBoolean(isShort) || type === "short",
      isLive: parseBoolean(isLive),
      liveScheduledAt: liveScheduledAt || null,
      uploadedBy: userId,
      isUserUpload: true,
    });

    return media;
  }

  async createUploadSession({ body, userId }) {
    const requestedProvider = body.provider || VIDEO_STORAGE_PROVIDER || "cloudinary";
    const providers = Array.from(new Set([
      requestedProvider,
      !body.provider && VIDEO_FALLBACK_PROVIDER ? VIDEO_FALLBACK_PROVIDER : null,
    ].filter(Boolean)));

    let lastError = null;
    for (const provider of providers) {
      try {
        const session = await this.createProviderUploadSession({ provider, body, userId });
        if (provider !== requestedProvider && lastError) {
          return {
            ...session,
            fallbackFrom: requestedProvider,
            primaryError: lastError.message || "Primary upload provider unavailable",
          };
        }
        return session;
      } catch (err) {
        lastError = err;
        if (body.provider || provider !== requestedProvider) {
          throw err;
        }
      }
    }

    if (lastError) throw lastError;
    return this.createProviderUploadSession({ provider: requestedProvider, body, userId });
  }

  async createProviderUploadSession({ provider, body, userId }) {
    if (provider === "bunny") {
      const upload = await bunnyService.createDirectUpload({
        title: body.title || "",
      });
      const videoId = upload.video.guid || upload.video.id;

      return {
        uploadId: videoId,
        provider: "bunny",
        mode: "direct",
        status: "created",
        maxServerUploadMb: MAX_VIDEO_SIZE_MB,
        directUpload: {
          uploadUrl: upload.uploadUrl,
          method: "TUS",
          headers: upload.headers,
          expiresAt: upload.expiresAt,
        },
        asset: {
          videoId,
          hlsUrl: upload.hlsUrl,
          playbackUrl: upload.playbackUrl,
          thumbnailUrl: upload.thumbnailUrl,
        },
      };
    }

    if (provider === "mux") {
      const passthrough = JSON.stringify({
        userId,
        title: body.title || "",
        type: body.type || "movie",
      });
      const upload = await muxService.createDirectUpload({
        passthrough,
        corsOrigin: body.corsOrigin,
      });

      return {
        uploadId: upload.id,
        provider: "mux",
        mode: "direct",
        status: upload.status,
        maxServerUploadMb: MAX_VIDEO_SIZE_MB,
        directUpload: {
          uploadUrl: upload.url,
          method: "PUT",
          headers: { "Content-Type": body.mimeType || "application/octet-stream" },
          expiresAt: upload.timeout ? new Date(Date.now() + upload.timeout * 1000) : null,
        },
      };
    }

    return {
      uploadId: `upload_${Date.now()}_${userId}`,
      provider,
      mode: DIRECT_UPLOAD_ENABLED ? "direct" : "server",
      status: DIRECT_UPLOAD_ENABLED ? "ready" : "provider_configuration_required",
      maxServerUploadMb: MAX_VIDEO_SIZE_MB,
      recommended: "Use Bunny Stream direct uploads for videos, with Mux as fallback.",
      metadata: {
        title: body.title || "",
        type: body.type || "movie",
        category: body.category || "general",
      },
      directUpload: DIRECT_UPLOAD_ENABLED
        ? {
            uploadUrl: null,
            headers: {},
            expiresAt: null,
            message: "Direct upload provider is enabled but adapter credentials are not configured in this build.",
          }
        : null,
    };
  }

  async registerBunnyUpload({ body, userId, user }) {
    const videoId = body.directUploadId || body.videoId || body.storageKey;
    if (!videoId) {
      throw { status: 400, message: "directUploadId or videoId is required" };
    }

    const video = await bunnyService.getVideo(videoId);
    const playback = bunnyService.getPlayback(videoId);
    const processingStatus = bunnyService.getProcessingStatus(video);

    const media = await this.completeExternalUpload({
      body: {
        ...body,
        mediaUrl: playback.hlsUrl || body.mediaUrl || `bunny://videos/${videoId}`,
        playbackUrl: playback.playbackUrl || body.playbackUrl || "",
        hlsUrl: playback.hlsUrl || body.hlsUrl || "",
        thumbnailUrl: body.thumbnailUrl || playback.thumbnailUrl || video.thumbnailUrl || "",
        duration: video.length || video.duration || body.duration || 0,
        storageProvider: "bunny",
        storageKey: videoId,
        transcodingProvider: "bunny",
        processingStatus,
        publishStatus: processingStatus === "ready" ? (body.publishStatus || "pending_review") : "processing",
      },
      userId,
      user,
    });

    return { media, video };
  }

  async syncBunnyMedia(mediaId, userId) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }
    if (media.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only sync your own uploads" };
    }
    if (media.storageProvider !== "bunny" || !media.storageKey) {
      throw { status: 400, message: "This media is not a Bunny upload" };
    }

    const video = await bunnyService.getVideo(media.storageKey);
    const playback = bunnyService.getPlayback(media.storageKey);
    const processingStatus = bunnyService.getProcessingStatus(video);

    media.duration = video.length || video.duration || media.duration;
    media.playbackUrl = playback.playbackUrl || media.playbackUrl;
    media.hlsUrl = playback.hlsUrl || media.hlsUrl;
    media.mediaUrl = playback.hlsUrl || media.mediaUrl;
    media.thumbnailUrl = media.thumbnailUrl || playback.thumbnailUrl;
    media.processingStatus = processingStatus;
    media.publishStatus = processingStatus === "ready" && media.reviewStatus === "approved" ? "published" : processingStatus === "ready" ? "pending_review" : processingStatus;
    await media.save();

    return media;
  }

  async registerMuxUpload({ body, userId, user }) {
    const { directUploadId } = body;
    if (!directUploadId) {
      throw { status: 400, message: "directUploadId is required" };
    }

    const upload = await muxService.getDirectUpload(directUploadId);
    let asset = null;
    if (upload.asset_id) {
      asset = await muxService.getAsset(upload.asset_id);
    }

    const playback = asset ? muxService.getPlayback(asset.playback_ids || []) : {};
    const media = await this.completeExternalUpload({
      body: {
        ...body,
        mediaUrl: playback.hlsUrl || `mux://uploads/${directUploadId}`,
        playbackUrl: playback.playbackUrl || "",
        hlsUrl: playback.hlsUrl || "",
        duration: asset?.duration || body.duration || 0,
        storageProvider: "mux",
        storageKey: asset?.id || upload.asset_id || directUploadId,
        transcodingProvider: "mux",
        processingStatus: asset?.status === "ready" ? "ready" : "processing",
        publishStatus: asset?.status === "ready" ? (body.publishStatus || "pending_review") : "processing",
      },
      userId,
      user,
    });

    return { media, upload, asset };
  }

  async syncMuxMedia(mediaId, userId) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }
    if (media.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only sync your own uploads" };
    }
    if (media.storageProvider !== "mux" || !media.storageKey) {
      throw { status: 400, message: "This media is not a Mux upload" };
    }

    const asset = await muxService.getAsset(media.storageKey);
    const playback = muxService.getPlayback(asset.playback_ids || []);

    media.duration = asset.duration || media.duration;
    media.playbackUrl = playback.playbackUrl || media.playbackUrl;
    media.hlsUrl = playback.hlsUrl || media.hlsUrl;
    media.mediaUrl = playback.hlsUrl || media.mediaUrl;
    media.processingStatus = asset.status === "ready" ? "ready" : "processing";
    media.publishStatus = asset.status === "ready" && media.reviewStatus === "approved" ? "published" : asset.status === "ready" ? "pending_review" : "processing";
    await media.save();

    return media;
  }

  async completeExternalUpload({ body, userId, user }) {
    const {
      title,
      description,
      type,
      category,
      tags,
      genre,
      language,
      country,
      contentRating,
      releaseStatus,
      publishStatus,
      homeSections,
      isFeatured,
      featuredRank,
      availabilityCountries,
      artist,
      releaseYear,
      isLocked,
      isShort,
      isLive,
      liveScheduledAt,
      mediaUrl,
      playbackUrl,
      hlsUrl,
      thumbnailUrl,
      duration,
      fileSize,
      mimeType,
      storageProvider,
      storageKey,
      transcodingProvider,
      processingStatus,
    } = body;

    if (!title || !mediaUrl) {
      throw { status: 400, message: "Title and mediaUrl are required" };
    }

    const reviewState = this.getInitialReviewState(body, user);

    const media = await Media.create({
      title,
      description: description || "",
      type: type || "movie",
      category: category || "general",
      tags: parseList(tags),
      genre: genre || "",
      language: language || "",
      country: country || "",
      contentRating: contentRating || "",
      releaseStatus: releaseStatus || "released",
      publishStatus: processingStatus === "processing" ? "processing" : reviewState.publishStatus,
      reviewStatus: reviewState.reviewStatus,
      reviewedBy: reviewState.reviewedBy,
      reviewedAt: reviewState.reviewedAt,
      homeSections: parseList(homeSections),
      isFeatured: parseBoolean(isFeatured),
      featuredRank: featuredRank ? parseInt(featuredRank) : 0,
      availabilityCountries: parseList(availabilityCountries),
      ...parseRightsMetadata(body),
      artist: artist || "",
      releaseYear: releaseYear ? parseInt(releaseYear) : null,
      mediaUrl,
      playbackUrl: playbackUrl || mediaUrl,
      hlsUrl: hlsUrl || "",
      thumbnailUrl: thumbnailUrl || "",
      duration: duration ? Number(duration) : 0,
      fileSize: fileSize ? Number(fileSize) : 0,
      mimeType: mimeType || "video/mp4",
      storageProvider: storageProvider || "external",
      storageKey: storageKey || "",
      transcodingProvider: transcodingProvider || "none",
      processingStatus: processingStatus || "uploaded",
      isLocked: parseBoolean(isLocked),
      isShort: parseBoolean(isShort) || type === "short",
      isLive: parseBoolean(isLive),
      liveScheduledAt: liveScheduledAt || null,
      uploadedBy: userId,
      isUserUpload: true,
    });

    return media;
  }

  // ── Get all media with filters and pagination ─────────────────────────
  async getAllMedia({ type, category, isLocked, isShort, isLive, language, country, homeSection, search, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" }) {
    const query = { isActive: true, ...publicPublishFilter() };

    if (type) query.type = type;
    if (category) query.category = category;
    if (language) query.language = new RegExp(`^${language}$`, "i");
    if (country) query.country = new RegExp(`^${country}$`, "i");
    if (homeSection) query.homeSections = homeSection;
    if (isLocked !== undefined) query.isLocked = isLocked === "true";
    if (isShort !== undefined) query.isShort = isShort === "true";
    if (isLive !== undefined) query.isLive = isLive === "true";

    // Full-text search across title, description, tags, artist
    if (search) {
      query.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const [media, total] = await Promise.all([
      Media.find(query)
        .populate("uploadedBy", "profileName username profilePic subscriberCount")
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments(query),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get single media by ID ────────────────────────────────────────────
  async getMediaById(mediaId) {
    const media = await Media.findById(mediaId)
      .populate("uploadedBy", "profileName username profilePic subscriberCount");

    if (!isPublicMedia(media)) {
      throw { status: 404, message: "Media not found" };
    }

    // Increment view count
    await Media.findByIdAndUpdate(mediaId, { $inc: { viewCount: 1 } });

    return media;
  }

  // ── Update media ──────────────────────────────────────────────────────
  async updateMedia(mediaId, userId, updates) {
    const media = await Media.findById(mediaId);

    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }

    // Only uploader can edit their own media
    if (media.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only edit your own uploads" };
    }

    const allowedUpdates = [
      "title", "description", "category", "tags",
      "genre", "language", "country", "contentRating",
      "releaseStatus", "homeSections", "isFeatured",
      "featuredRank", "availabilityCountries", "artist", "releaseYear",
      "isLocked", "liveScheduledAt", "playbackUrl", "hlsUrl",
      "processingStatus", "processingError", "licenseType", "licenseUrl",
      "sourceUrl", "sourceName", "attributionText", "rightsSummary",
      "requiresAttribution", "isRightsVerified", "rightsVerifiedAt",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        if (["tags", "homeSections", "availabilityCountries"].includes(field)) {
          media[field] = parseList(updates[field]);
        } else if (field === "licenseType") {
          media[field] = LICENSE_TYPES.has(updates[field]) ? updates[field] : "unknown";
        } else if (["requiresAttribution", "isRightsVerified"].includes(field)) {
          media[field] = parseBoolean(updates[field]);
        } else if (field === "rightsVerifiedAt") {
          media[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          media[field] = updates[field];
        }
      }
    });

    await media.save();
    return media;
  }

  // ── Delete media ──────────────────────────────────────────────────────
  async deleteMedia(mediaId, userId) {
    const media = await Media.findById(mediaId);

    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }

    if (media.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only delete your own uploads" };
    }

    // Soft delete — set isActive to false
    // Files stay on Cloudinary (saves bandwidth, recoverable)
    // For hard delete: also call cloudinaryService.deleteFile()
    media.isActive = false;
    await media.save();

    return { message: "Media deleted successfully" };
  }

  // ── Like / Unlike media ───────────────────────────────────────────────
  async toggleLike(mediaId) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }
    await Media.findByIdAndUpdate(mediaId, { $inc: { likeCount: 1 } });
    return { likeCount: media.likeCount + 1 };
  }

  async toggleDislike(mediaId) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }
    await Media.findByIdAndUpdate(mediaId, { $inc: { dislikeCount: 1 } });
    return { dislikeCount: media.dislikeCount + 1 };
  }

  async addComment(mediaId, userId, text) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }
    const comment = {
      user: userId,
      text: text.trim(),
    };
    await Media.findByIdAndUpdate(mediaId, {
      $push: { comments: comment },
      $inc: { commentCount: 1 },
    });
    return {
      commentCount: media.commentCount + 1,
      comment,
    };
  }

  // ── Save / unsave media ───────────────────────────────────────────────
  async toggleSave(mediaId, userId) {
    const media = await Media.findById(mediaId);
    if (!media || !media.isActive) {
      throw { status: 404, message: "Media not found" };
    }

    const user = await User.findById(userId);
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const alreadySaved = user.savedMedia?.some((savedId) => savedId.toString() === mediaId.toString());
    if (alreadySaved) {
      await User.findByIdAndUpdate(userId, {
        $pull: { savedMedia: mediaId },
        $inc: { savedMediaCount: -1 },
      });
      await Media.findByIdAndUpdate(mediaId, {
        $inc: { savedCount: -1 },
      });
      return {
        saved: false,
        message: "Removed from saved content",
      };
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { savedMedia: mediaId },
      $inc: { savedMediaCount: 1 },
    });
    await Media.findByIdAndUpdate(mediaId, {
      $inc: { savedCount: 1 },
    });

    return {
      saved: true,
      message: "Saved to your profile",
    };
  }

  async toggleCreatorSubscription(creatorId, userId) {
    if (creatorId.toString() === userId.toString()) {
      throw { status: 400, message: "You cannot subscribe to yourself" };
    }

    const [creator, user] = await Promise.all([
      User.findById(creatorId),
      User.findById(userId),
    ]);

    if (!creator || !creator.isActive) {
      throw { status: 404, message: "Creator not found" };
    }
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const alreadySubscribed = user.subscribedCreators?.some(
      (id) => id.toString() === creatorId.toString()
    );

    if (alreadySubscribed) {
      await User.findByIdAndUpdate(userId, {
        $pull: { subscribedCreators: creatorId },
      });
      await User.findByIdAndUpdate(creatorId, {
        $inc: { subscriberCount: -1 },
      });
      return {
        subscribed: false,
        subscriberCount: Math.max((creator.subscriberCount || 0) - 1, 0),
        message: "Unsubscribed from creator",
      };
    }

    await User.findByIdAndUpdate(userId, {
      $addToSet: { subscribedCreators: creatorId },
    });
    await User.findByIdAndUpdate(creatorId, {
      $inc: { subscriberCount: 1 },
    });

    return {
      subscribed: true,
      subscriberCount: (creator.subscriberCount || 0) + 1,
      message: "Subscribed to creator",
    };
  }

  async remixMedia(mediaId, userId, data = {}) {
    const source = await Media.findById(mediaId);
    if (!source || !source.isActive) {
      throw { status: 404, message: "Media not found" };
    }

    const remix = await Media.create({
      title: data.title?.trim() || `Remix: ${source.title}`,
      description: data.description?.trim() || `Remix of ${source.title}`,
      type: "short",
      category: source.category || "general",
      tags: Array.from(new Set([...(source.tags || []), "remix"])),
      genre: source.genre || "",
      artist: source.artist || "",
      licenseType: source.licenseType || "unknown",
      licenseUrl: source.licenseUrl || "",
      sourceUrl: source.sourceUrl || "",
      sourceName: source.sourceName || "",
      attributionText: source.attributionText || "",
      rightsSummary: source.rightsSummary || "",
      requiresAttribution: source.requiresAttribution || false,
      isRightsVerified: source.isRightsVerified || false,
      rightsVerifiedAt: source.rightsVerifiedAt || null,
      mediaUrl: source.mediaUrl,
      cloudinaryPublicId: source.cloudinaryPublicId,
      thumbnailUrl: source.thumbnailUrl,
      thumbnailCloudinaryId: source.thumbnailCloudinaryId,
      duration: source.duration,
      fileSize: source.fileSize,
      mimeType: source.mimeType,
      isLocked: false,
      isShort: true,
      uploadedBy: userId,
      isUserUpload: true,
      originalMedia: source._id,
    });

    await Media.findByIdAndUpdate(mediaId, { $inc: { remixCount: 1 } });
    await remix.populate("uploadedBy", "profileName username profilePic subscriberCount");

    return {
      remix,
      remixCount: (source.remixCount || 0) + 1,
      message: "Remix created",
    };
  }

  async getSavedMedia(userId, page = 1, limit = 20) {
    const user = await User.findById(userId).select("savedMedia");
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const savedIds = user.savedMedia || [];
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [media, total] = await Promise.all([
      Media.find({ _id: { $in: savedIds }, isActive: true, ...publicPublishFilter() })
        .populate("uploadedBy", "profileName username profilePic subscriberCount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments({ _id: { $in: savedIds }, isActive: true, ...publicPublishFilter() }),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get media by uploader ─────────────────────────────────────────────
  async getMediaByUser(userId, page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [media, total] = await Promise.all([
      Media.find({ uploadedBy: userId, isActive: true, ...publicPublishFilter() })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments({ uploadedBy: userId, isActive: true, ...publicPublishFilter() }),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get Shorts (max 3 min videos) ────────────────────────────────────
  async getShorts(page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [media, total] = await Promise.all([
      Media.find({ isShort: true, isActive: true, ...publicPublishFilter() })
        .populate("uploadedBy", "profileName username profilePic subscriberCount")
        .populate("comments.user", "username profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments({ isShort: true, isActive: true, ...publicPublishFilter() }),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  async getSubscribedShorts(userId, page = 1, limit = 20) {
    const user = await User.findById(userId).select("subscribedCreators");
    if (!user) {
      throw { status: 404, message: "User not found" };
    }

    const creatorIds = user.subscribedCreators || [];
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [media, total] = await Promise.all([
      Media.find({ isShort: true, isActive: true, ...publicPublishFilter(), uploadedBy: { $in: creatorIds } })
        .populate("uploadedBy", "profileName username profilePic subscriberCount")
        .populate("comments.user", "username profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments({ isShort: true, isActive: true, ...publicPublishFilter(), uploadedBy: { $in: creatorIds } }),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get Live Events ───────────────────────────────────────────────────
  async getLiveEvents(page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [media, total] = await Promise.all([
      Media.find({ isLive: true, isActive: true, ...publicPublishFilter() })
        .populate("uploadedBy", "profileName username profilePic subscriberCount")
        .sort({ liveScheduledAt: 1 }) // earliest first
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Media.countDocuments({ isLive: true, isActive: true, ...publicPublishFilter() }),
    ]);

    return {
      media,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }
}

module.exports = new MediaService();

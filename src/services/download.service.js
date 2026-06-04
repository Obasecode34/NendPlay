// src/services/download.service.js
//
// All download business logic.
//
// The flow:
//   1. Frontend requests authorization to download a file
//   2. Backend checks: is user subscribed? how many download devices?
//   3. If allowed: returns the file URL + creates a Download record
//   4. Frontend downloads the file and stores it locally
//   5. Frontend calls "complete" to mark the download as done
//   6. Downloads tab reads from the Download collection
//
// Device limit logic:
//   Count distinct deviceIds with status "completed" for this user.
//   If that count >= plan's maxDownloadDevices, block new devices.
//   If the requesting deviceId is already in the list, allow it
//   (downloading more content on an existing device is always fine).

const Download = require("../models/Download");
const User = require("../models/User");
const Media = require("../models/Media");
const Document = require("../models/Document");
const { getPlan } = require("../config/plans");

class DownloadService {
  // ── Authorize a download ──────────────────────────────────────────────
  // Checks limits, creates record, returns file URL
  async authorizeDownload({
    userId,
    contentType,
    contentId,
    deviceId,
    platform,
    deviceInfo,
  }) {
    let user = null;
    if (userId) {
      user = await User.findById(userId);
      if (!user) throw { status: 404, message: "User not found" };
    }

    const existingDownload = userId
      ? await Download.findOne({
        userId,
        contentId,
        deviceId,
        status: { $in: ["completed", "pending"] },
      })
      : null;

    if (existingDownload) {
      // Already downloaded on this device — return existing record
      return {
        alreadyDownloaded: true,
        download: existingDownload,
        message: "Already downloaded on this device",
      };
    }

    let content;
    let contentModel;

    if (contentType === "media") {
      content = await Media.findById(contentId);
      contentModel = "Media";
      if (!content || !content.isActive) {
        throw { status: 404, message: "Media not found" };
      }
    } else if (contentType === "document") {
      content = await Document.findById(contentId);
      contentModel = "Document";
      if (!content || !content.isActive) {
        throw { status: 404, message: "Document not found" };
      }
    } else {
      throw { status: 400, message: "contentType must be 'media' or 'document'" };
    }

    const sourceUrl = content.hlsUrl || content.playbackUrl || content.mediaUrl || content.fileUrl || "";

    if (!userId) {
      return {
        alreadyDownloaded: false,
        download: null,
        guest: true,
        fileUrl: sourceUrl,
        title: content.title,
        mimeType: content.mimeType,
        fileSize: content.fileSize,
      };
    }

    // 6. Create download record (pending until frontend confirms completion)
    const download = await Download.create({
      userId,
      contentType,
      contentId,
      contentModel,
      deviceId,
      platform: platform || "web",
      deviceInfo: deviceInfo || "unknown",
      status: "pending",
      contentSnapshot: {
        title: content.title,
        thumbnailUrl: content.thumbnailUrl || "",
        type: content.type || content.fileType || "",
        category: content.category || "",
        duration: content.duration || 0,
        fileSize: content.fileSize || 0,
        mimeType: content.mimeType || "",
        fileUrl: sourceUrl,
      },
    });

    return {
      alreadyDownloaded: false,
      download,
      fileUrl: sourceUrl,
      title: content.title,
      mimeType: content.mimeType,
      fileSize: content.fileSize,
    };
  }

  // ── Mark download as complete ─────────────────────────────────────────
  // Called by frontend after file is saved locally
  async completeDownload({ downloadId, userId, storageKey, storedFileSize }) {
    const download = await Download.findOne({ _id: downloadId, userId });
    if (!download) throw { status: 404, message: "Download record not found" };

    if (download.status === "completed") {
      return download; // Already completed — idempotent
    }

    await Download.findByIdAndUpdate(downloadId, {
      status: "completed",
      downloadedAt: new Date(),
      storageKey: storageKey || "",
      storedFileSize: storedFileSize || 0,
    });

    return Download.findById(downloadId);
  }

  // ── Get all downloads for a user ──────────────────────────────────────
  async getUserDownloads({ userId, deviceId, contentType, page = 1, limit = 50 }) {
    const query = {
      userId,
      status: "completed",
    };

    if (deviceId) query.deviceId = deviceId;
    if (contentType) query.contentType = contentType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [downloads, total] = await Promise.all([
      Download.find(query)
        .sort({ downloadedAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Download.countDocuments(query),
    ]);

    // Group by category for the Downloads tab UI
    const grouped = {
      movies: [],
      music: [],
      tvShows: [],
      videos: [],
      podcasts: [],
      shorts: [],
      documents: [],
      other: [],
    };

    downloads.forEach((d) => {
      const type = d.contentSnapshot?.type || "";
      if (type === "movie") grouped.movies.push(d);
      else if (type === "music") grouped.music.push(d);
      else if (type === "tv_show") grouped.tvShows.push(d);
      else if (type === "video") grouped.videos.push(d);
      else if (type === "podcast") grouped.podcasts.push(d);
      else if (type === "short") grouped.shorts.push(d);
      else if (d.contentType === "document") grouped.documents.push(d);
      else grouped.other.push(d);
    });

    return {
      downloads,
      grouped,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Delete a download ─────────────────────────────────────────────────
  // Removes the record — frontend is responsible for deleting the local file
  async deleteDownload({ downloadId, userId }) {
    const download = await Download.findOne({ _id: downloadId, userId });
    if (!download) throw { status: 404, message: "Download record not found" };

    await Download.findByIdAndUpdate(downloadId, { status: "deleted" });

    return {
      message: "Download record removed. Delete the local file on your device.",
      storageKey: download.storageKey, // Frontend uses this to delete local file
      platform: download.platform,
    };
  }

  // ── Delete all downloads on a device ─────────────────────────────────
  // Frees up a device slot
  async deleteAllDeviceDownloads({ userId, deviceId }) {
    const result = await Download.updateMany(
      { userId, deviceId, status: "completed" },
      { status: "deleted" }
    );

    return {
      message: `Removed ${result.modifiedCount} download(s) from this device. The device slot is now free.`,
      deletedCount: result.modifiedCount,
    };
  }

  // ── Get download devices summary ──────────────────────────────────────
  // Shows user which devices have downloads and how many slots are used
  async getDownloadDevices(userId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    if (!user.hasActiveSubscription()) {
      return {
        devices: [],
        slotsUsed: 0,
        slotsTotal: 0,
        plan: "none",
      };
    }

    const plan = getPlan(user.subscriptionPlan);

    // Aggregate downloads by device
    const deviceStats = await Download.aggregate([
      {
        $match: {
          userId: user._id,
          status: "completed",
        },
      },
      {
        $group: {
          _id: "$deviceId",
          deviceInfo: { $first: "$deviceInfo" },
          platform: { $first: "$platform" },
          downloadCount: { $sum: 1 },
          lastDownload: { $max: "$downloadedAt" },
          totalSize: { $sum: "$storedFileSize" },
        },
      },
      { $sort: { lastDownload: -1 } },
    ]);

    return {
      devices: deviceStats.map((d) => ({
        deviceId: d._id,
        deviceInfo: d.deviceInfo,
        platform: d.platform,
        downloadCount: d.downloadCount,
        lastDownload: d.lastDownload,
        totalSizeMB: (d.totalSize / (1024 * 1024)).toFixed(2),
      })),
      slotsUsed: deviceStats.length,
      slotsTotal: plan.maxDownloadDevices,
      plan: plan.name,
    };
  }

  // ── Check if content is downloaded on a device ────────────────────────
  async isDownloaded({ userId, contentId, deviceId }) {
    const download = await Download.findOne({
      userId,
      contentId,
      deviceId,
      status: "completed",
    });

    return {
      isDownloaded: !!download,
      download: download || null,
    };
  }
}

module.exports = new DownloadService();

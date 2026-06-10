// src/controllers/download.controller.js

const downloadService = require("../services/download.service");
const ApiResponse = require("../utils/apiResponse");

class DownloadController {
  // POST /api/downloads/authorize
  // Frontend calls this BEFORE downloading.
  // Returns the file URL + creates a pending download record.
  async authorizeDownload(req, res) {
    try {
      const { contentType, contentId, deviceId, platform } = req.body;

      if (!contentType) return ApiResponse.badRequest(res, "contentType is required");
      if (!contentId) return ApiResponse.badRequest(res, "contentId is required");
      if (!deviceId) return ApiResponse.badRequest(res, "deviceId is required");

      const deviceInfo = req.headers["user-agent"] || "unknown";

      const result = await downloadService.authorizeDownload({
        userId: req.user?.userId,
        contentType,
        contentId,
        deviceId,
        platform: platform || "web",
        deviceInfo,
      });

      return ApiResponse.success(res, {
        message: result.alreadyDownloaded
          ? "Already downloaded on this device"
          : "Download authorized. Save the file locally then call /complete.",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Authorize download error:", err);
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Authorization failed",
      });
    }
  }

  // POST /api/downloads/complete
  // Frontend calls this AFTER saving the file locally.
  // Marks the download record as completed.
  async completeDownload(req, res) {
    try {
      const { downloadId, storageKey, storedFileSize } = req.body;
      if (!downloadId) return ApiResponse.badRequest(res, "downloadId is required");

      const download = await downloadService.completeDownload({
        downloadId,
        userId: req.user?.userId,
        storageKey,
        storedFileSize,
      });

      return ApiResponse.success(res, {
        message: "Download completed and saved",
        data: { download },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/downloads — get all downloads for current user
  async getUserDownloads(req, res) {
    try {
      const { deviceId, contentType, page, limit } = req.query;

      const result = await downloadService.getUserDownloads({
        userId: req.user.userId,
        deviceId,
        contentType,
        page,
        limit,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // DELETE /api/downloads/:id — delete a single download record
  async deleteDownload(req, res) {
    try {
      const result = await downloadService.deleteDownload({
        downloadId: req.params.id,
        userId: req.user.userId,
      });

      return ApiResponse.success(res, {
        message: result.message,
        data: {
          storageKey: result.storageKey,
          platform: result.platform,
        },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // DELETE /api/downloads/device/:deviceId — remove all downloads on a device
  async deleteDeviceDownloads(req, res) {
    try {
      const result = await downloadService.deleteAllDeviceDownloads({
        userId: req.user.userId,
        deviceId: req.params.deviceId,
      });

      return ApiResponse.success(res, {
        message: result.message,
        data: { deletedCount: result.deletedCount },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/downloads/devices — get download device summary
  async getDownloadDevices(req, res) {
    try {
      const result = await downloadService.getDownloadDevices(req.user.userId);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/downloads/check — check if specific content is downloaded
  async checkDownload(req, res) {
    try {
      const { contentId, deviceId } = req.query;
      if (!contentId) return ApiResponse.badRequest(res, "contentId is required");
      if (!deviceId) return ApiResponse.badRequest(res, "deviceId is required");

      const result = await downloadService.isDownloaded({
        userId: req.user.userId,
        contentId,
        deviceId,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }
}

module.exports = new DownloadController();

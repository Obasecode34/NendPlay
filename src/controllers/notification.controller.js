const notificationService = require("../services/notification.service");
const cloudinaryService = require("../services/cloudinary.service");
const ApiResponse = require("../utils/apiResponse");

function parseNotificationPayload(body = {}) {
  const payload = { ...body };
  if (typeof payload.data === "string") {
    try {
      payload.data = JSON.parse(payload.data);
    } catch {
      payload.data = {};
    }
  }
  return payload;
}

class NotificationController {
  async registerPushToken(req, res) {
    try {
      const { token, platform, deviceId, guestId } = req.body;
      const pushToken = await notificationService.registerPushToken({
        userId: req.user?.userId,
        guestId,
        token,
        platform,
        deviceId,
      });

      return ApiResponse.success(res, {
        message: "Push notifications enabled",
        data: { pushToken },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Failed to register push token" });
    }
  }

  async unregisterPushToken(req, res) {
    try {
      const { token, guestId } = req.body;
      const result = await notificationService.unregisterPushToken({
        userId: req.user?.userId,
        guestId,
        token,
      });

      return ApiResponse.success(res, result);
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Failed to disable push token" });
    }
  }

  async getPushTokens(req, res) {
    try {
      const tokens = await notificationService.getUserPushTokens(req.user.userId);
      return ApiResponse.success(res, { data: { tokens } });
    } catch {
      return ApiResponse.error(res);
    }
  }

  async getPushStats(req, res) {
    try {
      const [stats, inAppStats] = await Promise.all([
        notificationService.getPushTokenStats(),
        notificationService.getInAppNotificationStats(),
      ]);
      stats.inApp = inAppStats;
      return ApiResponse.success(res, { data: { stats } });
    } catch (err) {
      return ApiResponse.error(res, { message: err.message || "Failed to load push notification stats" });
    }
  }

  async sendPushNotification(req, res) {
    try {
      const payload = parseNotificationPayload(req.body);
      if (req.file) {
        const upload = await cloudinaryService.uploadThumbnail(req.file.buffer, {
          folder: "nendplay/notifications",
        });
        payload.imageUrl = upload.secure_url;
        payload.imageCloudinaryId = upload.public_id;
      }

      const result = await notificationService.sendPushNotification(payload, req.admin);
      return ApiResponse.success(res, {
        message: "Push notification sent",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: err.message || "Failed to send push notification" });
    }
  }

  async sendInAppNotification(req, res) {
    try {
      const payload = parseNotificationPayload(req.body);
      if (req.file) {
        const upload = await cloudinaryService.uploadThumbnail(req.file.buffer, {
          folder: "nendplay/notifications",
        });
        payload.imageUrl = upload.secure_url;
        payload.imageCloudinaryId = upload.public_id;
      }

      const notification = await notificationService.createInAppNotification(payload, req.admin);
      return ApiResponse.created(res, {
        message: "Notification sent",
        data: { notification },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: err.message || "Failed to send notification" });
    }
  }

  async getMyNotifications(req, res) {
    try {
      const result = await notificationService.getUserNotifications(req.user.userId, req.query);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: err.message || "Failed to load notifications" });
    }
  }

  async markNotificationRead(req, res) {
    try {
      const result = await notificationService.markNotificationRead(req.user.userId, req.params.id);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: err.message || "Failed to update notification" });
    }
  }

  async markAllNotificationsRead(req, res) {
    try {
      const result = await notificationService.markAllNotificationsRead(req.user.userId);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: err.message || "Failed to update notifications" });
    }
  }
}

module.exports = new NotificationController();

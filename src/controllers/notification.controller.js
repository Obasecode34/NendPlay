const notificationService = require("../services/notification.service");
const ApiResponse = require("../utils/apiResponse");

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
      const stats = await notificationService.getPushTokenStats();
      return ApiResponse.success(res, { data: { stats } });
    } catch (err) {
      return ApiResponse.error(res, { message: err.message || "Failed to load push notification stats" });
    }
  }

  async sendPushNotification(req, res) {
    try {
      const result = await notificationService.sendPushNotification(req.body, req.admin);
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
}

module.exports = new NotificationController();

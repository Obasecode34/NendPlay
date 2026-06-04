const notificationService = require("../services/notification.service");
const ApiResponse = require("../utils/apiResponse");

class NotificationController {
  async registerPushToken(req, res) {
    try {
      const { token, platform, deviceId } = req.body;
      const pushToken = await notificationService.registerPushToken({
        userId: req.user.userId,
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
      const { token } = req.body;
      const result = await notificationService.unregisterPushToken({
        userId: req.user.userId,
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
}

module.exports = new NotificationController();

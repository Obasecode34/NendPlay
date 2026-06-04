const PushToken = require("../models/PushToken");

class NotificationService {
  async registerPushToken({ userId, token, platform = "unknown", deviceId = "" }) {
    if (!token) throw { status: 400, message: "Push token is required" };

    const pushToken = await PushToken.findOneAndUpdate(
      { token },
      {
        userId,
        token,
        platform,
        deviceId,
        isActive: true,
        lastSeenAt: new Date(),
      },
      { new: true, upsert: true, runValidators: true }
    );

    return pushToken;
  }

  async unregisterPushToken({ userId, token }) {
    if (!token) throw { status: 400, message: "Push token is required" };

    await PushToken.findOneAndUpdate(
      { userId, token },
      { isActive: false, lastSeenAt: new Date() }
    );

    return { message: "Push token disabled" };
  }

  async getUserPushTokens(userId) {
    return PushToken.find({ userId, isActive: true })
      .sort({ lastSeenAt: -1 })
      .lean();
  }
}

module.exports = new NotificationService();

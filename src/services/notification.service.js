const PushToken = require("../models/PushToken");
const User = require("../models/User");
const axios = require("axios");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_BATCH_SIZE = 100;

function chunk(items, size) {
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function isExpoPushToken(token) {
  return /^Expo(nent)?PushToken\[[^\]]+\]$/.test(String(token || ""));
}

class NotificationService {
  async registerPushToken({ userId, guestId = "", token, platform = "unknown", deviceId = "" }) {
    if (!token) throw { status: 400, message: "Push token is required" };

    const normalizedGuestId = String(guestId || deviceId || "").trim();
    const pushToken = await PushToken.findOneAndUpdate(
      { token },
      {
        userId: userId || null,
        guestId: normalizedGuestId,
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

  async unregisterPushToken({ userId, guestId = "", token }) {
    if (!token) throw { status: 400, message: "Push token is required" };

    const filter = { token };
    if (userId) filter.userId = userId;
    else if (guestId) filter.guestId = guestId;

    await PushToken.findOneAndUpdate(filter, { isActive: false, lastSeenAt: new Date() });

    return { message: "Push token disabled" };
  }

  async getUserPushTokens(userId) {
    return PushToken.find({ userId, isActive: true })
      .sort({ lastSeenAt: -1 })
      .lean();
  }

  async getPushTokenStats() {
    const adminUsers = await User.find({
      role: { $in: ["admin", "super_admin"] },
      isActive: true,
    }).select("_id").lean();
    const adminUserIds = adminUsers.map((user) => user._id);

    const [
      totalTokens,
      activeTokens,
      usersWithTokens,
      adminActiveTokens,
      adminUsersWithTokens,
      guestActiveTokens,
    ] = await Promise.all([
      PushToken.countDocuments(),
      PushToken.countDocuments({ isActive: true }),
      PushToken.distinct("userId", { isActive: true, userId: { $ne: null } }),
      PushToken.countDocuments({ isActive: true, userId: { $in: adminUserIds } }),
      PushToken.distinct("userId", { isActive: true, userId: { $in: adminUserIds } }),
      PushToken.countDocuments({
        isActive: true,
        $or: [{ userId: null }, { userId: { $exists: false } }],
      }),
    ]);

    return {
      totalTokens,
      activeTokens,
      usersWithTokens: usersWithTokens.length,
      adminActiveTokens,
      adminUsersWithTokens: adminUsersWithTokens.length,
      guestActiveTokens,
    };
  }

  async getRecipientRoleStats(tokens) {
    const userIds = [...new Set(tokens.map((item) => String(item.userId || "")).filter(Boolean))];
    if (!userIds.length) {
      return {
        adminTokens: 0,
        adminUsers: 0,
        userTokens: 0,
        userUsers: 0,
        guestTokens: tokens.length,
      };
    }

    const users = await User.find({ _id: { $in: userIds } }).select("_id role").lean();
    const roleByUserId = new Map(users.map((user) => [String(user._id), user.role || "user"]));
    const adminUserIds = new Set();
    const regularUserIds = new Set();
    let adminTokens = 0;
    let userTokens = 0;
    let guestTokens = 0;

    tokens.forEach((item) => {
      const id = String(item.userId || "");
      if (!id) {
        guestTokens += 1;
        return;
      }
      const role = roleByUserId.get(id);
      if (role === "admin" || role === "super_admin") {
        adminTokens += 1;
        adminUserIds.add(id);
      } else {
        userTokens += 1;
        if (id) regularUserIds.add(id);
      }
    });

    return {
      adminTokens,
      adminUsers: adminUserIds.size,
      userTokens,
      userUsers: regularUserIds.size,
      guestTokens,
    };
  }

  async resolveAudience({ audience = "all", userId, userIds = [] } = {}) {
    const filter = { isActive: true };
    const ids = [];

    if (userId) ids.push(userId);
    if (Array.isArray(userIds)) ids.push(...userIds.filter(Boolean));

    if (ids.length) {
      filter.userId = { $in: ids };
    } else if (audience === "subscribers") {
      const users = await User.find({
        isActive: true,
        subscriptionPlan: { $ne: "none" },
        subscriptionExpiry: { $gt: new Date() },
      }).select("_id").lean();
      filter.userId = { $in: users.map((user) => user._id) };
    } else if (audience === "free_users") {
      const users = await User.find({
        isActive: true,
        $or: [
          { subscriptionPlan: "none" },
          { subscriptionPlan: { $exists: false } },
          { subscriptionExpiry: { $lte: new Date() } },
          { subscriptionExpiry: null },
        ],
      }).select("_id").lean();
      filter.userId = { $in: users.map((user) => user._id) };
    } else if (audience !== "all") {
      throw { status: 400, message: "Invalid notification audience" };
    }

    return PushToken.find(filter).lean();
  }

  buildExpoMessages(tokens, { title, body, data = {}, sound = "default", priority = "high", imageUrl = "" }) {
    const cleanImageUrl = String(imageUrl || "").trim();
    return tokens
      .filter((item) => isExpoPushToken(item.token))
      .map((item) => ({
        to: item.token,
        title,
        body,
        data: {
          ...data,
          ...(cleanImageUrl ? { imageUrl: cleanImageUrl } : {}),
          sentAt: new Date().toISOString(),
        },
        ...(cleanImageUrl ? { richContent: { image: cleanImageUrl } } : {}),
        sound,
        priority,
      }));
  }

  async sendPushNotification({ audience, userId, userIds, title, body, data, sound, priority, imageUrl, imageCloudinaryId }, admin) {
    const cleanTitle = String(title || "").trim();
    const cleanBody = String(body || "").trim();
    const cleanImageUrl = String(imageUrl || "").trim();

    if (!cleanTitle) throw { status: 400, message: "Notification title is required" };
    if (!cleanBody) throw { status: 400, message: "Notification message is required" };
    if (cleanTitle.length > 80) throw { status: 400, message: "Notification title cannot exceed 80 characters" };
    if (cleanBody.length > 180) throw { status: 400, message: "Notification message cannot exceed 180 characters" };

    const tokens = await this.resolveAudience({ audience, userId, userIds });
    const recipientStats = await this.getRecipientRoleStats(tokens);
    const messages = this.buildExpoMessages(tokens, {
      title: cleanTitle,
      body: cleanBody,
      data,
      sound,
      priority,
      imageUrl: cleanImageUrl,
    });

    if (!messages.length) {
      return {
        sentBy: admin?.id,
        audience: audience || (userId || userIds?.length ? "selected_users" : "all"),
        requestedTokens: tokens.length,
        validTokens: 0,
        sent: 0,
        errors: 0,
        recipientStats,
        imageUrl: cleanImageUrl,
        imageCloudinaryId: imageCloudinaryId || "",
        includesAdmins: (audience || "all") === "all" || recipientStats.adminTokens > 0,
        tickets: [],
      };
    }

    const tickets = [];
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      const response = await axios.post(EXPO_PUSH_URL, batch, {
        headers: { "Content-Type": "application/json" },
        timeout: 20000,
      });
      const result = Array.isArray(response.data?.data) ? response.data.data : [];
      tickets.push(...result);
    }

    const invalidTokens = [];
    tickets.forEach((ticket, index) => {
      if (ticket?.details?.error === "DeviceNotRegistered") {
        invalidTokens.push(messages[index]?.to);
      }
    });

    if (invalidTokens.length) {
      await PushToken.updateMany(
        { token: { $in: invalidTokens } },
        { isActive: false, lastSeenAt: new Date() }
      );
    }

    const errors = tickets.filter((ticket) => ticket?.status === "error").length;

    return {
      sentBy: admin?.id,
      audience: audience || (userId || userIds?.length ? "selected_users" : "all"),
      requestedTokens: tokens.length,
      validTokens: messages.length,
      sent: messages.length - errors,
      errors,
      invalidatedTokens: invalidTokens.length,
      recipientStats,
      imageUrl: cleanImageUrl,
      imageCloudinaryId: imageCloudinaryId || "",
      includesAdmins: (audience || "all") === "all" || recipientStats.adminTokens > 0,
      tickets,
    };
  }
}

module.exports = new NotificationService();

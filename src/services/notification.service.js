const PushToken = require("../models/PushToken");
const InAppNotification = require("../models/InAppNotification");
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
  normalizeNotificationAudience({ audience = "all", userId, userIds = [] } = {}) {
    const ids = [];
    if (userId) ids.push(userId);
    if (Array.isArray(userIds)) ids.push(...userIds.filter(Boolean));

    return {
      audience: ids.length ? "selected_users" : audience || "all",
      userIds: ids,
    };
  }

  buildInAppVisibilityFilter(user) {
    const now = new Date();
    const userId = user?._id || user?.userId;
    const role = user?.role || "user";
    const isAdmin = ["admin", "super_admin"].includes(role);
    const isSubscriber = Boolean(
      user?.subscriptionPlan &&
      user.subscriptionPlan !== "none" &&
      user.subscriptionExpiry &&
      new Date(user.subscriptionExpiry) > now
    );

    const audienceFilters = [
      { audience: "all" },
      { audience: "users" },
      { audience: "selected_users", userIds: userId },
    ];
    if (isAdmin) audienceFilters.push({ audience: "admins" });
    if (isSubscriber) audienceFilters.push({ audience: "subscribers" });
    else audienceFilters.push({ audience: "free_users" });

    return {
      isActive: true,
      $and: [
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
        { $or: audienceFilters },
      ],
    };
  }

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

  async getInAppNotificationStats() {
    const [total, active, unreadEligibleUsers] = await Promise.all([
      InAppNotification.countDocuments(),
      InAppNotification.countDocuments({ isActive: true }),
      User.countDocuments({ isActive: true }),
    ]);

    return { total, active, eligibleUsers: unreadEligibleUsers };
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

  async createInAppNotification({
    audience,
    userId,
    userIds,
    title,
    body,
    screen = "Home",
    contentType = "",
    contentId = "",
    data = {},
    imageUrl,
    imageCloudinaryId,
    expiresAt,
  }, admin) {
    const cleanTitle = String(title || "").trim();
    const cleanBody = String(body || "").trim();
    const cleanImageUrl = String(imageUrl || "").trim();
    const normalized = this.normalizeNotificationAudience({ audience, userId, userIds });

    if (!cleanTitle) throw { status: 400, message: "Notification title is required" };
    if (!cleanBody) throw { status: 400, message: "Notification message is required" };
    if (cleanTitle.length > 120) throw { status: 400, message: "Notification title cannot exceed 120 characters" };
    if (cleanBody.length > 800) throw { status: 400, message: "Notification message cannot exceed 800 characters" };

    const notification = await InAppNotification.create({
      title: cleanTitle,
      body: cleanBody,
      audience: normalized.audience,
      userIds: normalized.userIds,
      sentBy: admin?.id || null,
      screen: String(screen || "Home").trim() || "Home",
      contentType: ["news", "media"].includes(String(contentType || "").toLowerCase())
        ? String(contentType).toLowerCase()
        : "",
      contentId: String(contentId || "").trim(),
      data: data && typeof data === "object" ? data : {},
      imageUrl: cleanImageUrl,
      imageCloudinaryId: imageCloudinaryId || "",
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    return notification;
  }

  async getUserNotifications(userId, { page = 1, limit = 20, unreadOnly = false } = {}) {
    const user = await User.findById(userId)
      .select("role subscriptionPlan subscriptionExpiry")
      .lean();
    if (!user) throw { status: 404, message: "User not found" };

    const safePage = Math.max(Number(page) || 1, 1);
    const safeLimit = Math.min(Math.max(Number(limit) || 20, 1), 50);
    const filter = this.buildInAppVisibilityFilter(user);
    if (unreadOnly === true || unreadOnly === "true") {
      filter["readBy.userId"] = { $ne: user._id };
    }

    const [items, total, unread] = await Promise.all([
      InAppNotification.find(filter)
        .sort({ createdAt: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .populate("sentBy", "profileName username role profilePic")
        .lean(),
      InAppNotification.countDocuments(filter),
      InAppNotification.countDocuments({
        ...this.buildInAppVisibilityFilter(user),
        "readBy.userId": { $ne: user._id },
      }),
    ]);

    const notifications = items.map((item) => ({
      ...item,
      isRead: item.readBy?.some((entry) => String(entry.userId) === String(user._id)) || false,
      readBy: undefined,
    }));

    return {
      notifications,
      unread,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        pages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  async markNotificationRead(userId, notificationId) {
    const notification = await InAppNotification.findById(notificationId);
    if (!notification) throw { status: 404, message: "Notification not found" };

    await InAppNotification.updateOne(
      { _id: notificationId, "readBy.userId": { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } }
    );

    return { message: "Notification marked as read" };
  }

  async markAllNotificationsRead(userId) {
    const { notifications } = await this.getUserNotifications(userId, { page: 1, limit: 50, unreadOnly: true });
    const ids = notifications.map((item) => item._id);
    if (!ids.length) return { modified: 0 };

    const result = await InAppNotification.updateMany(
      { _id: { $in: ids }, "readBy.userId": { $ne: userId } },
      { $push: { readBy: { userId, readAt: new Date() } } }
    );

    return { modified: result.modifiedCount || 0 };
  }
}

module.exports = new NotificationService();

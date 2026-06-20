const AnalyticsEvent = require("../models/AnalyticsEvent");
const User = require("../models/User");
const Media = require("../models/Media");
const Document = require("../models/Document");
const NewsPost = require("../models/NewsPost");
const Ad = require("../models/Ad");
const Download = require("../models/Download");

const EVENT_TYPES = new Set([
  "app_open",
  "screen_view",
  "media_watch",
  "novel_read",
  "news_read",
  "career_click",
  "unspoken_open",
  "comment",
  "share",
  "like",
  "download",
  "ad_impression",
  "ad_click",
]);

function startOfDay(date = new Date()) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function daysAgo(days) {
  const next = startOfDay();
  next.setDate(next.getDate() - days);
  return next;
}

function startOfYear() {
  const now = new Date();
  return new Date(now.getFullYear(), 0, 1);
}

function sanitizeMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  return Object.entries(metadata).slice(0, 25).reduce((next, [key, value]) => {
    if (["string", "number", "boolean"].includes(typeof value) || value === null) {
      next[String(key).slice(0, 80)] = value;
    }
    return next;
  }, {});
}

async function aggregateEvents(from) {
  return AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: "$eventType",
        total: { $sum: 1 },
        guests: { $sum: { $cond: [{ $eq: ["$userRole", "guest"] }, 1, 0] } },
        registered: { $sum: { $cond: [{ $ne: ["$userRole", "guest"] }, 1, 0] } },
      },
    },
  ]);
}

async function eventSeries(from, unit = "day") {
  const format = unit === "month" ? "%Y-%m" : "%Y-%m-%d";
  return AnalyticsEvent.aggregate([
    { $match: { createdAt: { $gte: from } } },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format, date: "$createdAt" } },
          eventType: "$eventType",
        },
        total: { $sum: 1 },
      },
    },
    { $sort: { "_id.bucket": 1 } },
  ]);
}

function mapEventTotals(rows = []) {
  return rows.reduce((next, row) => {
    next[row._id] = {
      total: row.total || 0,
      guests: row.guests || 0,
      registered: row.registered || 0,
    };
    return next;
  }, {});
}

class AnalyticsService {
  async track({ user, body, headers }) {
    const eventType = String(body.eventType || "").trim();
    if (!EVENT_TYPES.has(eventType)) {
      throw { status: 400, message: "Unsupported analytics event type" };
    }

    let userRole = "guest";
    if (user?.userId) {
      const dbUser = await User.findById(user.userId).select("role").lean();
      userRole = dbUser?.role || "user";
    }

    const event = await AnalyticsEvent.create({
      eventType,
      screen: body.screen || "",
      section: body.section || "",
      contentType: body.contentType || "",
      contentId: body.contentId || null,
      userId: user?.userId || null,
      userRole,
      guestId: body.guestId || headers["x-guest-id"] || "",
      platform: ["web", "mobile"].includes(body.platform) ? body.platform : "unknown",
      metadata: sanitizeMetadata(body.metadata),
    });

    return { id: event._id };
  }

  async getAdminSummary() {
    const today = startOfDay();
    const week = daysAgo(6);
    const year = startOfYear();

    const [
      dailyEvents,
      weeklyEvents,
      yearlyEvents,
      dailySeries,
      weeklySeries,
      yearlySeries,
      totalUsers,
      guestActorsToday,
      registeredUsers,
      adminUsers,
      mediaTotals,
      documentTotals,
      newsTotals,
      newsBySection,
      adTotals,
      downloadTotals,
    ] = await Promise.all([
      aggregateEvents(today),
      aggregateEvents(week),
      aggregateEvents(year),
      eventSeries(today, "day"),
      eventSeries(week, "day"),
      eventSeries(year, "month"),
      User.countDocuments(),
      AnalyticsEvent.distinct("guestId", { guestId: { $ne: "" }, createdAt: { $gte: today } }),
      User.countDocuments({ role: "user" }),
      User.countDocuments({ role: { $in: ["admin", "super_admin"] } }),
      Media.aggregate([{ $group: { _id: null, views: { $sum: "$viewCount" }, likes: { $sum: "$likeCount" }, comments: { $sum: "$commentCount" } } }]),
      Document.aggregate([{ $group: { _id: null, views: { $sum: "$viewCount" }, likes: { $sum: "$likeCount" }, downloads: { $sum: "$downloadCount" } } }]),
      NewsPost.aggregate([{ $group: { _id: null, views: { $sum: "$viewCount" }, likes: { $sum: "$likeCount" }, comments: { $sum: "$commentCount" }, shares: { $sum: "$shareCount" }, posts: { $sum: 1 } } }]),
      NewsPost.aggregate([
        {
          $group: {
            _id: "$section",
            views: { $sum: "$viewCount" },
            likes: { $sum: "$likeCount" },
            comments: { $sum: "$commentCount" },
            shares: { $sum: "$shareCount" },
            posts: { $sum: 1 },
          },
        },
      ]),
      Ad.aggregate([{ $group: { _id: null, impressions: { $sum: "$impressions" }, clicks: { $sum: "$clicks" }, ads: { $sum: 1 } } }]),
      Download.countDocuments({ status: "completed" }),
    ]);

    const totals = {
      users: {
        total: totalUsers,
        guestsToday: guestActorsToday.length,
        registered: registeredUsers,
        admins: adminUsers,
      },
      media: mediaTotals[0] || { views: 0, likes: 0, comments: 0 },
      novels: documentTotals[0] || { views: 0, likes: 0, downloads: 0 },
      news: newsTotals[0] || { posts: 0, views: 0, likes: 0, comments: 0, shares: 0 },
      newsBySection: newsBySection.reduce((next, row) => {
        next[row._id || "news"] = {
          views: row.views || 0,
          likes: row.likes || 0,
          comments: row.comments || 0,
          shares: row.shares || 0,
          posts: row.posts || 0,
        };
        return next;
      }, {}),
      ads: adTotals[0] || { ads: 0, impressions: 0, clicks: 0 },
      downloads: downloadTotals,
    };

    return {
      periods: {
        daily: mapEventTotals(dailyEvents),
        weekly: mapEventTotals(weeklyEvents),
        yearly: mapEventTotals(yearlyEvents),
      },
      totals,
      charts: {
        daily: dailySeries,
        weekly: weeklySeries,
        yearly: yearlySeries,
      },
    };
  }
}

module.exports = new AnalyticsService();

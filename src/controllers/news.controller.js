const newsService = require("../services/news.service");
const ApiResponse = require("../utils/apiResponse");
const analyticsService = require("../services/analytics.service");

function trackRequestEvent(req, eventType, data = {}) {
  analyticsService.track({
    user: req.user,
    headers: req.headers,
    body: {
      eventType,
      platform: req.headers["x-client-platform"] || "unknown",
      ...data,
    },
  }).catch(() => {});
}

function eventTypeForSection(section = "news") {
  if (section === "career") return "career_click";
  if (section === "unspoken") return "unspoken_open";
  return "news_read";
}

class NewsController {
  async getDailyNews(req, res) {
    try {
      const { category, search, page, limit, tab, section, jobMode, country, city, region } = req.query;
      const result = await newsService.getDailyNews({
        category,
        search,
        page,
        limit,
        tab,
        section,
        jobMode,
        country,
        city,
        region,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Failed to load daily news",
      });
    }
  }

  async createNewsPost(req, res) {
    try {
      const post = await newsService.createNewsPost({
        body: req.body,
        files: req.files || [],
        adminId: req.admin.id,
      });
      return ApiResponse.created(res, {
        message: "News posted successfully",
        data: { post },
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to post news",
      });
    }
  }

  async listAdminNews(req, res) {
    try {
      const result = await newsService.listInternalNews({
        ...req.query,
        includeDrafts: true,
      });
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to load admin news",
      });
    }
  }

  async updateNewsPost(req, res) {
    try {
      const post = await newsService.updateNewsPost(req.params.id, {
        body: req.body,
        files: req.files || [],
        adminId: req.admin.id,
      });
      return ApiResponse.success(res, {
        message: "News updated",
        data: { post },
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to update news",
      });
    }
  }

  async deleteNewsPost(req, res) {
    try {
      const result = await newsService.deleteNewsPost(req.params.id);
      return ApiResponse.success(res, {
        message: "News deleted",
        data: result,
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to delete news",
      });
    }
  }

  async getNewsPost(req, res) {
    try {
      const post = await newsService.getNewsPost(req.params.id);
      trackRequestEvent(req, eventTypeForSection(post.section), {
        screen: post.section || "news",
        section: post.section || "news",
        contentType: "news",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: { post } });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to load news post",
      });
    }
  }

  async addComment(req, res) {
    try {
      const post = await newsService.addComment(req.params.id, req.user.userId, req.body.text);
      trackRequestEvent(req, "comment", {
        screen: post.section || "news",
        section: post.section || "news",
        contentType: "news",
        contentId: req.params.id,
      });
      return ApiResponse.created(res, {
        message: "Comment posted",
        data: { post },
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to comment on news",
      });
    }
  }

  async replyToComment(req, res) {
    try {
      const post = await newsService.replyToComment(
        req.params.id,
        req.params.commentId,
        req.user.userId,
        req.body.text
      );
      trackRequestEvent(req, "comment", {
        screen: post.section || "news",
        section: post.section || "news",
        contentType: "news",
        contentId: req.params.id,
      });
      return ApiResponse.created(res, {
        message: "Reply posted",
        data: { post },
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to reply to comment",
      });
    }
  }

  async toggleLike(req, res) {
    try {
      const result = await newsService.toggleLike(req.params.id, req.user.userId);
      trackRequestEvent(req, "like", {
        screen: "news",
        contentType: "news",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to like news",
      });
    }
  }

  async toggleCommentLike(req, res) {
    try {
      const post = await newsService.toggleCommentLike(req.params.id, req.params.commentId, req.user.userId);
      trackRequestEvent(req, "like", {
        screen: post.section || "news",
        section: post.section || "news",
        contentType: "news_comment",
        contentId: req.params.commentId,
      });
      return ApiResponse.success(res, { data: { post } });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to like comment",
      });
    }
  }

  async recordShare(req, res) {
    try {
      const result = await newsService.recordShare(req.params.id);
      trackRequestEvent(req, "share", {
        screen: "news",
        contentType: "news",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, {
        message: "Share recorded",
        data: result,
      });
    } catch (err) {
      return ApiResponse.error(res, {
        statusCode: err.status || 500,
        message: err.message || "Failed to share news",
      });
    }
  }
}

module.exports = new NewsController();

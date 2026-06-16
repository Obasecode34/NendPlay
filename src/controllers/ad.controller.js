// src/controllers/ad.controller.js

const adService = require("../services/ad.service");
const ApiResponse = require("../utils/apiResponse");

class AdController {
  // GET /api/ads/pricing — get price quote before submitting
  getPriceQuote(req, res) {
    try {
      const { adType, placement, durationDays } = req.query;
      const quote = adService.getAdPriceQuote({
        adType,
        placement,
        durationDays: parseInt(durationDays),
      });
      return ApiResponse.success(res, { data: { quote } });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/ads/submit — submit ad + initialize payment
  async submitAd(req, res) {
    try {
      const result = await adService.submitAd({
        userId: req.user.userId,
        body: req.body,
      });

      return ApiResponse.created(res, {
        message: "Ad submitted. Complete payment to activate your ad.",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Ad submit error:", err);
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Failed to submit ad",
      });
    }
  }

  // POST /api/ads/verify — verify payment after redirect
  async verifyAdPayment(req, res) {
    try {
      const { transactionRef, gateway } = req.body;
      if (!transactionRef) return ApiResponse.badRequest(res, "transactionRef is required");
      if (!gateway) return ApiResponse.badRequest(res, "gateway is required");

      const result = await adService.verifyAdPayment({ transactionRef, gateway });
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Verification failed",
      });
    }
  }

  // GET /api/ads/serve — get ads for a given context
  // Frontend calls this to know which ads to show
  async serveAds(req, res) {
    try {
      const { placement, isLiveEvent, limit } = req.query;

      // Determine subscription status
      let isSubscribed = false;
      if (req.user) {
        const User = require("../models/User");
        const user = await User.findById(req.user.userId);
        isSubscribed = user?.hasActiveSubscription() || false;
      }

      const result = await adService.getAdsForContext({
        isSubscribed,
        placement: placement || "all",
        isLiveEvent: isLiveEvent === "true",
        limit,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/ads/:id/impression — record an ad impression
  async recordImpression(req, res) {
    try {
      await adService.recordImpression(req.params.id);
      return ApiResponse.success(res, { message: "Impression recorded" });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/ads/:id/click — record click and return target URL
  async recordClick(req, res) {
    try {
      const result = await adService.recordClick(req.params.id);
      return ApiResponse.success(res, {
        message: "Click recorded",
        data: { targetUrl: result.targetUrl },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/ads/my — get advertiser's own ads
  async getMyAds(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await adService.getMyAds(req.user.userId, page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/ads/:id — get single ad
  async getAdById(req, res) {
    try {
      const ad = await adService.getAdById(req.params.id);
      return ApiResponse.success(res, { data: { ad } });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/ads/:id/toggle — pause or resume ad
  async toggleAdStatus(req, res) {
    try {
      const result = await adService.toggleAdStatus(req.params.id, req.user.userId);
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/ads/:id/analytics — get ad performance analytics
  async getAdAnalytics(req, res) {
    try {
      const result = await adService.getAdAnalytics(req.params.id, req.user.userId);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }
}

module.exports = new AdController();

const rewardService = require("../services/reward.service");
const admobSsvService = require("../services/admobSsv.service");
const ApiResponse = require("../utils/apiResponse");

class RewardController {
  async getStatus(req, res) {
    try {
      const status = await rewardService.getStatus(req.user.userId);
      return ApiResponse.success(res, { data: status });
    } catch (err) {
      if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      return ApiResponse.error(res);
    }
  }

  async earnFromAd(req, res) {
    try {
      const status = await rewardService.earnFromAd({
        userId: req.user.userId,
        coins: req.body.coins,
        source: req.body.source || "rewarded_ad",
      });
      return ApiResponse.success(res, {
        message: "Coins added",
        data: status,
      });
    } catch (err) {
      if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      return ApiResponse.error(res);
    }
  }

  async admobSsv(req, res) {
    try {
      const result = await admobSsvService.handleRewardCallback(req);
      return res.status(200).json({
        success: true,
        message: result.duplicate ? "Reward already processed" : "Reward processed",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          message: err.message,
        });
      }
      console.error("AdMob SSV error:", err);
      return res.status(500).json({
        success: false,
        message: "AdMob SSV verification failed",
      });
    }
  }

  async redeem(req, res) {
    try {
      const status = await rewardService.redeem({
        userId: req.user.userId,
        rewardId: req.body.rewardId,
      });
      return ApiResponse.success(res, {
        message: "Reward redeemed",
        data: status,
      });
    } catch (err) {
      if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      return ApiResponse.error(res);
    }
  }

  async initializePaidAdFree(req, res) {
    try {
      const { days, gateway } = req.body;
      if (!days) return ApiResponse.badRequest(res, "days is required");
      if (!gateway) return ApiResponse.badRequest(res, "gateway is required (paystack or flutterwave)");

      const result = await rewardService.initializePaidAdFree({
        userId: req.user.userId,
        days,
        gateway,
      });

      return ApiResponse.success(res, {
        message: "Payment initialized. Redirect user to paymentUrl.",
        data: result,
      });
    } catch (err) {
      if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      console.error("Initialize ad-free payment error:", err);
      return ApiResponse.error(res, { statusCode: 500, message: err.message || "Failed to initialize ad-free payment" });
    }
  }

  async verifyPaidAdFree(req, res) {
    try {
      const { transactionRef, gateway } = req.body;
      if (!transactionRef) return ApiResponse.badRequest(res, "transactionRef is required");
      if (!gateway) return ApiResponse.badRequest(res, "gateway is required");

      const result = await rewardService.verifyPaidAdFree({ transactionRef, gateway });
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      return ApiResponse.error(res, { statusCode: 500, message: err.message || "Ad-free payment verification failed" });
    }
  }
}

module.exports = new RewardController();

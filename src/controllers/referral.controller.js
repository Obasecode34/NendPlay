// src/controllers/referral.controller.js

const referralService = require("../services/referral.service");
const ApiResponse = require("../utils/apiResponse");
const { CLIENT_URL } = require("../config/env");

class ReferralController {
  // GET /api/referrals/dashboard
  async getDashboard(req, res) {
    try {
      const dashboard = await referralService.getReferralDashboard(
        req.user.userId
      );
      return ApiResponse.success(res, { data: dashboard });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/referrals/link — get shareable referral link
  async getReferralLink(req, res) {
    try {
      const User = require("../models/User");
      const user = await User.findById(req.user.userId);
      if (!user) return ApiResponse.notFound(res, "User not found");

      const link = referralService.getReferralLink(
        user.referralCode,
        CLIENT_URL
      );

      return ApiResponse.success(res, {
        data: {
          referralCode: user.referralCode,
          referralLink: link,
          referralCount: user.referralCount,
        },
      });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/referrals/check-reward — manually trigger reward check
  // Useful if reward wasn't auto-granted (e.g. network issue during signup)
  async checkReward(req, res) {
    try {
      const result = await referralService.triggerRewardCheck(req.user.userId);

      if (!result) {
        const dashboard = await referralService.getReferralDashboard(
          req.user.userId
        );
        return ApiResponse.success(res, {
          message: `Referral rewards are granted automatically. Each successful referral earns ${dashboard.rewardPerReferral || 100} coins.`,
          data: {
            rewardPerReferral: dashboard.rewardPerReferral || 100,
            coinBalance: dashboard.coinBalance || 0,
          },
        });
      }

      return ApiResponse.success(res, {
        message: "Reward granted.",
        data: { reward: result },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/referrals/tiers — get all reward tiers (public)
  getTiers(req, res) {
    try {
      const { REWARD_TIERS, REFERRAL_COIN_REWARD } = require("../config/rewardTiers");
      return ApiResponse.success(res, {
        data: {
          tiers: REWARD_TIERS,
          rewardPerReferral: REFERRAL_COIN_REWARD,
        },
      });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }
}

module.exports = new ReferralController();

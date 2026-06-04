// src/middleware/subscription.middleware.js
//
// Enforces subscription access on locked content.
// Plugged into any route that serves locked media.
//
// Logic:
//   1. If content is not locked → pass through
//   2. If content is locked and user has active subscription → pass through
//   3. If content is locked and user has no subscription → 403

const User = require("../models/User");
const ApiResponse = require("../utils/apiResponse");

const requireSubscription = async (req, res, next) => {
  try {
    // req.user is set by authMiddleware
    if (!req.user) {
      return ApiResponse.unauthorized(res, "Please log in to access this content");
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return ApiResponse.unauthorized(res, "User not found");
    }

    // Check if subscription is active and not expired
    if (!user.hasActiveSubscription()) {
      return ApiResponse.error(res, {
        statusCode: 403,
        message: "This content requires an active NendPlay subscription. Visit /api/subs/plans to subscribe.",
      });
    }

    // Attach user doc to request for downstream use
    req.userDoc = user;
    next();
  } catch (err) {
    return ApiResponse.error(res, { statusCode: 500, message: "Subscription check failed" });
  }
};

// Soft check — attaches subscription status but doesn't block
// Used on routes that serve both free and locked content
const attachSubscriptionStatus = async (req, res, next) => {
  try {
    if (req.user) {
      const user = await User.findById(req.user.userId);
      if (user) {
        req.userDoc = user;
        req.isSubscribed = user.hasActiveSubscription();
      }
    } else {
      req.isSubscribed = false;
    }
    next();
  } catch (err) {
    req.isSubscribed = false;
    next();
  }
};

module.exports = { requireSubscription, attachSubscriptionStatus };

// src/controllers/subscription.controller.js

const subscriptionService = require("../services/subscription.service");
const ApiResponse = require("../utils/apiResponse");

class SubscriptionController {
  // GET /api/subs/plans — list all available plans (public)
  getPlans(req, res) {
    try {
      const plans = subscriptionService.getPlans();
      return ApiResponse.success(res, { data: { plans } });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/subs/initialize — start payment process
  async initializeSubscription(req, res) {
    try {
      const { planId, gateway } = req.body;

      if (!planId) return ApiResponse.badRequest(res, "planId is required");
      if (!gateway) return ApiResponse.badRequest(res, "gateway is required (paystack, flutterwave, opay, or palmpay)");

      const result = await subscriptionService.initializeSubscription({
        userId: req.user.userId,
        planId,
        gateway,
      });

      return ApiResponse.success(res, {
        message: "Payment initialized. Redirect user to paymentUrl.",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Initialize subscription error:", err);
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Failed to initialize payment",
      });
    }
  }

  // POST /api/subs/verify — verify payment after redirect
  async verifySubscription(req, res) {
    try {
      const { transactionRef, gateway } = req.body;

      if (!transactionRef) return ApiResponse.badRequest(res, "transactionRef is required");
      if (!gateway) return ApiResponse.badRequest(res, "gateway is required");

      const result = await subscriptionService.verifyAndActivate({
        transactionRef,
        gateway,
      });

      return ApiResponse.success(res, {
        message: result.message,
        data: result,
      });
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

  // POST /api/subs/cancel — cancel active subscription
  async cancelSubscription(req, res) {
    try {
      const { reason } = req.body;
      const result = await subscriptionService.cancelSubscription(
        req.user.userId,
        reason
      );
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/subs/me — get current user's subscription status
  async getMySubscription(req, res) {
    try {
      const result = await subscriptionService.getUserSubscription(req.user.userId);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/subs/history — get subscription history
  async getSubscriptionHistory(req, res) {
    try {
      const history = await subscriptionService.getSubscriptionHistory(req.user.userId);
      return ApiResponse.success(res, { data: { history } });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/subs/session/start — start a stream session
  async startSession(req, res) {
    try {
      const { deviceId, mediaId } = req.body;
      if (!deviceId) return ApiResponse.badRequest(res, "deviceId is required");
      if (!mediaId) return ApiResponse.badRequest(res, "mediaId is required");

      // Check concurrent stream limit
      const check = await subscriptionService.canStartStream(
        req.user.userId,
        deviceId,
        mediaId
      );

      if (!check.allowed) {
        return ApiResponse.error(res, { statusCode: 403, message: check.reason });
      }

      const deviceInfo = req.headers["user-agent"] || "unknown";
      await subscriptionService.startSession(
        req.user.userId,
        deviceId,
        mediaId,
        deviceInfo
      );

      return ApiResponse.success(res, { message: "Stream session started" });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/subs/session/end — end a stream session
  async endSession(req, res) {
    try {
      const { deviceId } = req.body;
      if (!deviceId) return ApiResponse.badRequest(res, "deviceId is required");
      await subscriptionService.endSession(req.user.userId, deviceId);
      return ApiResponse.success(res, { message: "Stream session ended" });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/subs/session/ping — heartbeat to keep session alive
  async pingSession(req, res) {
    try {
      const { deviceId } = req.body;
      if (!deviceId) return ApiResponse.badRequest(res, "deviceId is required");
      await subscriptionService.pingSession(req.user.userId, deviceId);
      return ApiResponse.success(res, { message: "Session kept alive" });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // POST /api/subs/webhook/paystack — Paystack webhook
  // Raw body needed for signature verification — configured in routes
  async paystackWebhook(req, res) {
    try {
      const signature = req.headers["x-paystack-signature"];
      await subscriptionService.handlePaystackWebhook(
        req.rawBody,
        signature,
        req.body
      );
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("Paystack webhook error:", err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  // POST /api/subs/webhook/flutterwave — Flutterwave webhook
  async flutterwaveWebhook(req, res) {
    try {
      const signature = req.headers["verif-hash"];
      await subscriptionService.handleFlutterwaveWebhook(signature, req.body);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("Flutterwave webhook error:", err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  async opayWebhook(req, res) {
    try {
      await subscriptionService.handleOpayWebhook(req.body);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("OPay webhook error:", err.message);
      return res.status(400).json({ error: err.message });
    }
  }

  async palmPayWebhook(req, res) {
    try {
      await subscriptionService.handlePalmPayWebhook(req.body);
      return res.status(200).json({ received: true });
    } catch (err) {
      console.error("PalmPay webhook error:", err.message);
      return res.status(400).json({ error: err.message });
    }
  }
}

module.exports = new SubscriptionController();

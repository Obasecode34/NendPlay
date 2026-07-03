// src/routes/subscription.routes.js
//
// Webhook routes need raw body for signature verification.
// We use express.raw() on those specific routes before the JSON parser.

const express = require("express");
const router = express.Router();

const subscriptionController = require("../controllers/subscription.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// ── Public routes ──────────────────────────────────────────────────────────
router.get("/plans", subscriptionController.getPlans);

// ── Webhook routes (raw body — must come before JSON middleware) ───────────
// These endpoints receive raw bytes from payment gateways
router.post(
  "/webhook/paystack",
  express.raw({ type: "application/json" }),
  (req, res, next) => {
    // Store raw body string for signature verification
    req.rawBody = req.body.toString("utf8");
    req.body = JSON.parse(req.rawBody);
    next();
  },
  subscriptionController.paystackWebhook
);

router.post(
  "/webhook/flutterwave",
  subscriptionController.flutterwaveWebhook
);

router.post(
  "/webhook/opay",
  express.json({ type: "*/*" }),
  subscriptionController.opayWebhook
);

router.post(
  "/webhook/palmpay",
  express.json({ type: "*/*" }),
  subscriptionController.palmPayWebhook
);

// ── Protected routes (auth required) ─────────────────────────────────────
router.post("/initialize", authMiddleware, subscriptionController.initializeSubscription);
router.post("/verify",     authMiddleware, subscriptionController.verifySubscription);
router.post("/cancel",     authMiddleware, subscriptionController.cancelSubscription);
router.get("/me",          authMiddleware, subscriptionController.getMySubscription);
router.get("/history",     authMiddleware, subscriptionController.getSubscriptionHistory);

// ── Stream session management ─────────────────────────────────────────────
router.post("/session/start", authMiddleware, subscriptionController.startSession);
router.post("/session/end",   authMiddleware, subscriptionController.endSession);
router.post("/session/ping",  authMiddleware, subscriptionController.pingSession);

module.exports = router;

// src/routes/ad.routes.js
//
// Ad endpoints.
// Specific named routes come before /:id
// to prevent "my", "serve", "pricing" being matched as IDs.

const express = require("express");
const router = express.Router();

const adController = require("../controllers/ad.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { attachSubscriptionStatus } = require("../middleware/subscription.middleware");
const { uploadAdCreative, handleMulterError } = require("../middleware/upload.middleware");

// ── Public routes ─────────────────────────────────────────────────────────
// Pricing quote — anyone can check prices before signing up
router.get("/pricing", adController.getPriceQuote);

// Serve ads — optionally authenticated (subscription status affects what's served)
// attachSubscriptionStatus attaches isSubscribed without blocking
router.get("/serve", attachSubscriptionStatus, adController.serveAds);

// ── Protected routes ──────────────────────────────────────────────────────
router.post(
  "/submit",
  authMiddleware,
  uploadAdCreative.single("creative"),
  handleMulterError,
  adController.submitAd
);
router.post("/verify",  authMiddleware, adController.verifyAdPayment);
router.get("/my",       authMiddleware, adController.getMyAds);

// ── Specific named routes before /:id ─────────────────────────────────────
router.get("/:id/analytics", authMiddleware, adController.getAdAnalytics);
router.patch("/:id/toggle",  authMiddleware, adController.toggleAdStatus);

// ── Analytics (public — frontend fires these automatically) ───────────────
router.post("/:id/impression", adController.recordImpression);
router.post("/:id/click",      adController.recordClick);

// ── Single ad ─────────────────────────────────────────────────────────────
router.get("/:id", adController.getAdById);

module.exports = router;

// src/routes/referral.routes.js

const express = require("express");
const router = express.Router();

const referralController = require("../controllers/referral.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

// ── Public ────────────────────────────────────────────────────────────────
router.get("/tiers", referralController.getTiers);

// ── Protected ─────────────────────────────────────────────────────────────
router.get("/dashboard",    authMiddleware, referralController.getDashboard);
router.get("/link",         authMiddleware, referralController.getReferralLink);
router.post("/check-reward",authMiddleware, referralController.checkReward);

module.exports = router;

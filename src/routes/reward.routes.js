const express = require("express");
const router = express.Router();
const rewardController = require("../controllers/reward.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

router.get("/admob/ssv", rewardController.admobSsv);
router.get("/status", authMiddleware, rewardController.getStatus);
router.post("/ad-earned", authMiddleware, rewardController.earnFromAd);
router.post("/redeem", authMiddleware, rewardController.redeem);
router.post("/ad-free/initialize", authMiddleware, rewardController.initializePaidAdFree);
router.post("/ad-free/verify", authMiddleware, rewardController.verifyPaidAdFree);

module.exports = router;

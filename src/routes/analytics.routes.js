const express = require("express");
const analyticsController = require("../controllers/analytics.controller");
const { optionalAuthMiddleware, authMiddleware, requireAdmin } = require("../middleware/auth.middleware");

const router = express.Router();

router.post("/track", optionalAuthMiddleware, analyticsController.track);
router.get("/admin/summary", authMiddleware, requireAdmin("dashboard:read"), analyticsController.adminSummary);

module.exports = router;

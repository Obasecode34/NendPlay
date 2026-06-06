const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notification.controller");
const { authMiddleware, requireAdmin } = require("../middleware/auth.middleware");

router.post("/register", authMiddleware, notificationController.registerPushToken);
router.post("/unregister", authMiddleware, notificationController.unregisterPushToken);
router.get("/tokens", authMiddleware, notificationController.getPushTokens);
router.get("/admin/stats", authMiddleware, requireAdmin("notifications:read"), notificationController.getPushStats);
router.post("/admin/send", authMiddleware, requireAdmin("notifications:write"), notificationController.sendPushNotification);

module.exports = router;

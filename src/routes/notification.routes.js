const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notification.controller");
const { authMiddleware, optionalAuthMiddleware, requireAdmin } = require("../middleware/auth.middleware");
const { uploadThumbnail, handleMulterError } = require("../middleware/upload.middleware");

router.post("/register", optionalAuthMiddleware, notificationController.registerPushToken);
router.post("/unregister", optionalAuthMiddleware, notificationController.unregisterPushToken);
router.get("/tokens", authMiddleware, notificationController.getPushTokens);
router.get("/admin/stats", authMiddleware, requireAdmin("notifications:read"), notificationController.getPushStats);
router.post(
  "/admin/send",
  authMiddleware,
  requireAdmin("notifications:write"),
  uploadThumbnail.single("image"),
  handleMulterError,
  notificationController.sendPushNotification
);

module.exports = router;

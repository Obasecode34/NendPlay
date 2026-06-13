const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notification.controller");
const { authMiddleware, optionalAuthMiddleware, requireAdmin } = require("../middleware/auth.middleware");
const { uploadThumbnail, handleMulterError } = require("../middleware/upload.middleware");

router.post("/register", optionalAuthMiddleware, notificationController.registerPushToken);
router.post("/unregister", optionalAuthMiddleware, notificationController.unregisterPushToken);
router.get("/public/popups", notificationController.getPublicPopups);
router.get("/tokens", authMiddleware, notificationController.getPushTokens);
router.get("/me", authMiddleware, notificationController.getMyNotifications);
router.patch("/me/read-all", authMiddleware, notificationController.markAllNotificationsRead);
router.patch("/me/:id/read", authMiddleware, notificationController.markNotificationRead);
router.get("/admin/stats", authMiddleware, requireAdmin("notifications:read"), notificationController.getPushStats);
router.get("/admin/in-app", authMiddleware, requireAdmin("notifications:read"), notificationController.listInAppNotifications);
router.delete("/admin/in-app/:id", authMiddleware, requireAdmin("notifications:write"), notificationController.deleteInAppNotification);
router.post(
  "/admin/send",
  authMiddleware,
  requireAdmin("notifications:write"),
  uploadThumbnail.single("image"),
  handleMulterError,
  notificationController.sendPushNotification
);
router.post(
  "/admin/in-app",
  authMiddleware,
  requireAdmin("notifications:write"),
  uploadThumbnail.single("image"),
  handleMulterError,
  notificationController.sendInAppNotification
);

module.exports = router;

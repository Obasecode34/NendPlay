const express = require("express");
const router = express.Router();

const notificationController = require("../controllers/notification.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

router.post("/register", authMiddleware, notificationController.registerPushToken);
router.post("/unregister", authMiddleware, notificationController.unregisterPushToken);
router.get("/tokens", authMiddleware, notificationController.getPushTokens);

module.exports = router;

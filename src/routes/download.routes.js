// src/routes/download.routes.js
//
// Download authorization is available to guests. Personal download history,
// device management, and deletion still require authentication.

const express = require("express");
const router = express.Router();

const downloadController = require("../controllers/download.controller");
const { authMiddleware, optionalAuthMiddleware } = require("../middleware/auth.middleware");

// Named routes first (before /:id)
router.get("/devices",              authMiddleware, downloadController.getDownloadDevices);
router.get("/check",                authMiddleware, downloadController.checkDownload);
router.post("/authorize",           optionalAuthMiddleware, downloadController.authorizeDownload);
router.post("/complete",            optionalAuthMiddleware, downloadController.completeDownload);
router.delete("/device/:deviceId",  authMiddleware, downloadController.deleteDeviceDownloads);

// General routes
router.get("/",         authMiddleware, downloadController.getUserDownloads);
router.delete("/:id",   authMiddleware, downloadController.deleteDownload);

module.exports = router;

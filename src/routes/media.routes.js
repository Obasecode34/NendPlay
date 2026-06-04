// src/routes/media.routes.js
//
// Media endpoints.
// Upload requires auth. Reading is public (locked content handled in controller).
// Specific routes (shorts, live, user) must come BEFORE /:id
// to prevent Express matching "shorts" as an ID.

const express = require("express");
const router = express.Router();

const mediaController = require("../controllers/media.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  uploadMediaWithThumbnail,
  handleMulterError,
} = require("../middleware/upload.middleware");

// ── Specific routes first (before /:id) ───────────────────────────────────
router.get("/shorts",        mediaController.getShorts);
router.get("/shorts/subscribed", authMiddleware, mediaController.getSubscribedShorts);
router.get("/live",          mediaController.getLiveEvents);
router.get("/user/:userId",  mediaController.getMediaByUser);
router.get("/saved",         authMiddleware, mediaController.getSavedMedia);
router.post("/creators/:creatorId/subscribe", authMiddleware, mediaController.subscribeCreator);

// ── Upload (auth required) ────────────────────────────────────────────────
// multipart/form-data with fields: "media" (required) + "thumbnail" (optional)
router.post(
  "/upload",
  authMiddleware,
  uploadMediaWithThumbnail.fields([
    { name: "media", maxCount: 1 },
    { name: "thumbnail", maxCount: 1 },
  ]),
  handleMulterError,
  mediaController.uploadMedia
);
router.post("/upload-session", authMiddleware, mediaController.createUploadSession);
router.post("/external", authMiddleware, mediaController.completeExternalUpload);

// ── CRUD ──────────────────────────────────────────────────────────────────
router.get("/",          mediaController.getAllMedia);
router.get("/:id",       mediaController.getMediaById);
router.get("/:id/stream", mediaController.streamMedia);
router.patch("/:id",     authMiddleware, mediaController.updateMedia);
router.delete("/:id",    authMiddleware, mediaController.deleteMedia);

// ── Engagement ────────────────────────────────────────────────────────────
router.post("/:id/like", authMiddleware, mediaController.likeMedia);
router.post("/:id/dislike", authMiddleware, mediaController.dislikeMedia);
router.post("/:id/comment", authMiddleware, mediaController.commentMedia);
router.post("/:id/save", authMiddleware, mediaController.saveMedia);
router.post("/:id/remix", authMiddleware, mediaController.remixMedia);
router.post("/:id/sync-bunny", authMiddleware, mediaController.syncBunnyMedia);
router.post("/:id/sync-mux", authMiddleware, mediaController.syncMuxMedia);

module.exports = router;

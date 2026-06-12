const express = require("express");
const router = express.Router();
const adminController = require("../controllers/admin.controller");
const { authMiddleware, requireAdmin } = require("../middleware/auth.middleware");
const {
  uploadMediaWithThumbnail,
  uploadNewsMedia,
  handleMulterError,
} = require("../middleware/upload.middleware");
const newsController = require("../controllers/news.controller");

router.use(authMiddleware);

router.get("/dashboard", requireAdmin("dashboard:read"), adminController.getDashboard);
router.get("/permissions", requireAdmin("users:read"), adminController.getPermissions);

router.get("/users", requireAdmin("users:read"), adminController.listUsers);
router.get("/users/:id", requireAdmin("users:read"), adminController.getUserDetails);
router.patch("/users/:id", requireAdmin("users:write"), adminController.updateUser);
router.post("/users/:id/email", requireAdmin("users:write"), adminController.sendUserEmail);
router.delete("/users/:id", requireAdmin("users:write"), adminController.deleteUser);

router.get("/media", requireAdmin("media:read"), adminController.listMedia);
router.post("/media/sync/bunny", requireAdmin("media:write"), adminController.syncBunnyMedia);
router.patch(
  "/media/:id",
  requireAdmin("media:write"),
  uploadMediaWithThumbnail.fields([{ name: "thumbnail", maxCount: 1 }]),
  handleMulterError,
  adminController.updateMedia
);
router.post("/media/:id/approve", requireAdmin("media:write"), adminController.approveMedia);
router.post("/media/:id/reject", requireAdmin("media:write"), adminController.rejectMedia);
router.delete("/media/:id", requireAdmin("media:write"), adminController.deleteMedia);

router.get("/documents", requireAdmin("documents:read"), adminController.listDocuments);
router.patch("/documents/:id", requireAdmin("documents:write"), adminController.updateDocument);
router.delete("/documents/:id", requireAdmin("documents:write"), adminController.deleteDocument);

router.get("/ads", requireAdmin("ads:read"), adminController.listAds);
router.patch("/ads/:id", requireAdmin("ads:write"), adminController.updateAd);

router.get("/subscriptions", requireAdmin("subscriptions:read"), adminController.listSubscriptions);
router.get("/downloads", requireAdmin("downloads:read"), adminController.listDownloads);
router.get("/rewards", requireAdmin("rewards:read"), adminController.listRewards);

router.get("/news", requireAdmin("notifications:read"), newsController.listAdminNews);
router.post(
  "/news",
  requireAdmin("notifications:write"),
  uploadNewsMedia.array("media", 10),
  handleMulterError,
  newsController.createNewsPost
);
router.patch(
  "/news/:id",
  requireAdmin("notifications:write"),
  uploadNewsMedia.array("media", 10),
  handleMulterError,
  newsController.updateNewsPost
);
router.delete("/news/:id", requireAdmin("notifications:write"), newsController.deleteNewsPost);

module.exports = router;

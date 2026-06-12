const express = require("express");
const router = express.Router();

const newsController = require("../controllers/news.controller");
const { authMiddleware } = require("../middleware/auth.middleware");

router.get("/", newsController.getDailyNews);
router.get("/:id", newsController.getNewsPost);
router.post("/:id/comments", authMiddleware, newsController.addComment);
router.post("/:id/share", newsController.recordShare);

module.exports = router;

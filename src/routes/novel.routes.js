// src/routes/novel.routes.js
//
// NovelHub endpoints.
// Specific routes (user/:userId) come before /:id
// to prevent "user" being matched as a document ID.

const express = require("express");
const router = express.Router();

const documentController = require("../controllers/document.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const {
  uploadDocument,
  handleDocumentUploadError,
} = require("../middleware/documentUpload.middleware");

// ── Specific routes first ─────────────────────────────────────────────────
router.get("/genres", documentController.getGenres);
router.get("/user/:userId", documentController.getDocumentsByUser);

// ── Upload (auth required) ────────────────────────────────────────────────
// multipart/form-data with field name: "document"
router.post(
  "/upload",
  authMiddleware,
  uploadDocument.single("document"),
  handleDocumentUploadError,
  documentController.uploadDocument
);

// ── CRUD ──────────────────────────────────────────────────────────────────
router.get("/",      documentController.getAllDocuments);
router.get("/:id",   documentController.getDocumentById);
router.patch("/:id", authMiddleware, documentController.updateDocument);
router.delete("/:id",authMiddleware, documentController.deleteDocument);

// ── Document actions ──────────────────────────────────────────────────────
router.post("/:id/fork",     authMiddleware, documentController.forkDocument);
router.get("/:id/download",  documentController.downloadDocument);
router.get("/:id/forks",     documentController.getDocumentForks);
router.post("/:id/like",     authMiddleware, documentController.likeDocument);

module.exports = router;

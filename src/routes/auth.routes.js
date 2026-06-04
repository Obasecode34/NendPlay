// src/routes/auth.routes.js
//
// Maps HTTP endpoints to controller methods.
// Middleware runs left-to-right per route:
//   limiter → validator → authMiddleware (if needed) → controller
//
// This file is just wiring — no logic here.

const express = require("express");
const router = express.Router();

const authController = require("../controllers/auth.controller");
const { authMiddleware } = require("../middleware/auth.middleware");
const { authLimiter } = require("../middleware/rateLimit.middleware");
const { uploadThumbnail, handleMulterError } = require("../middleware/upload.middleware");
const {
  validateRegister,
  validateLogin,
  validateGoogleAuth,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateChangePassword,
} = require("../middleware/validate.middleware");

// ── Public routes ─────────────────────────────────────────────────────────
// Rate limited — brute-force protection
router.post("/register", authLimiter, validateRegister, authController.register);
router.post("/login", authLimiter, validateLogin, authController.login);
router.post("/google", authLimiter, validateGoogleAuth, authController.googleAuth);
router.post("/forgot-password", authLimiter, validateForgotPassword, authController.forgotPassword);
router.post("/reset-password", authLimiter, validateResetPassword, authController.resetPassword);

// Refresh and logout use cookie — no body validation needed
router.post("/refresh-token", authController.refreshToken);
router.post("/logout", authMiddleware, authController.logout);

// ── Protected routes ──────────────────────────────────────────────────────
// authMiddleware verifies the Bearer token before the controller runs
router.get("/me", authMiddleware, authController.getMe);
router.patch("/update-profile", authMiddleware, validateUpdateProfile, authController.updateProfile);
router.patch(
  "/profile-picture",
  authMiddleware,
  uploadThumbnail.single("profilePic"),
  handleMulterError,
  authController.updateProfilePicture
);
router.patch("/change-password", authMiddleware, validateChangePassword, authController.changePassword);
router.patch("/update-email", authMiddleware, authController.updateEmail);
router.patch("/update-username", authMiddleware, authController.updateUsername);

module.exports = router;

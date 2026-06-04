// src/services/token.service.js
//
// All JWT logic lives here. Single responsibility: make and verify tokens.
// Access tokens are short-lived (15min) — they travel in Authorization headers.
// Refresh tokens are long-lived (7d) — they travel in HttpOnly cookies ONLY.
//
// HttpOnly cookies cannot be read by JavaScript — this is a security feature.
// Even if an attacker injects malicious JS into your frontend (XSS attack),
// they cannot steal the refresh token. It's invisible to JS.

const jwt = require("jsonwebtoken");
const Token = require("../models/Token");
const {
  JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN,
  JWT_REFRESH_EXPIRES_IN,
  COOKIE_SECURE,
  COOKIE_SAME_SITE,
} = require("../config/env");

class TokenService {
  // ── Generate access token ──────────────────────────────────────────────
  generateAccessToken(userId) {
    return jwt.sign(
      { userId, type: "access" },
      JWT_ACCESS_SECRET,
      { expiresIn: JWT_ACCESS_EXPIRES_IN }
    );
  }

  // ── Generate refresh token ─────────────────────────────────────────────
  generateRefreshToken(userId) {
    return jwt.sign(
      { userId, type: "refresh" },
      JWT_REFRESH_SECRET,
      { expiresIn: JWT_REFRESH_EXPIRES_IN }
    );
  }

  // ── Store refresh token in DB ──────────────────────────────────────────
  async storeRefreshToken(userId, token, deviceInfo = "unknown") {
    // Parse expiry from JWT to set the TTL for MongoDB auto-delete
    const decoded = jwt.decode(token);
    const expiresAt = new Date(decoded.exp * 1000); // JWT exp is in seconds

    await Token.create({ userId, token, expiresAt, deviceInfo });
  }

  // ── Verify access token ────────────────────────────────────────────────
  verifyAccessToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_ACCESS_SECRET);
      if (decoded.type !== "access") throw new Error("Invalid token type");
      return { valid: true, decoded };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  // ── Verify refresh token ───────────────────────────────────────────────
  verifyRefreshToken(token) {
    try {
      const decoded = jwt.verify(token, JWT_REFRESH_SECRET);
      if (decoded.type !== "refresh") throw new Error("Invalid token type");
      return { valid: true, decoded };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }

  // ── Check if refresh token exists in DB (not revoked) ──────────────────
  async findRefreshToken(token) {
    return Token.findOne({ token });
  }

  // ── Delete a specific refresh token (logout) ───────────────────────────
  async deleteRefreshToken(token) {
    return Token.deleteOne({ token });
  }

  // ── Delete ALL refresh tokens for a user (logout all devices) ──────────
  async deleteAllUserTokens(userId) {
    return Token.deleteMany({ userId });
  }

  // ── Set refresh token as HttpOnly cookie ──────────────────────────────
  setRefreshTokenCookie(res, token) {
    res.cookie("refreshToken", token, {
      httpOnly: true,          // JS cannot read this — XSS protection
      secure: COOKIE_SECURE,   // true in production (HTTPS only)
      sameSite: COOKIE_SAME_SITE,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      path: "/api/auth",       // Cookie only sent to /api/auth routes
    });
  }

  // ── Clear refresh token cookie (logout) ───────────────────────────────
  clearRefreshTokenCookie(res) {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: COOKIE_SECURE,
      sameSite: COOKIE_SAME_SITE,
      path: "/api/auth",
    });
  }
}

module.exports = new TokenService(); // singleton export

// src/middleware/rateLimit.middleware.js
//
// Rate limiting prevents brute-force attacks on auth endpoints.
// Without this, an attacker can try 10,000 passwords per second.
// With this, they get 10 attempts per 15 minutes — then blocked.
//
// Think of it as a turnstile: you can enter, but only so fast.

const rateLimit = require("express-rate-limit");
const ApiResponse = require("../utils/apiResponse");

// ── Strict limiter for auth endpoints (login, register) ─────────────────
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 10,                   // 10 requests per window per IP
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, {
      statusCode: 429,
      message: "Too many attempts. Please wait 15 minutes before trying again.",
    });
  },
});

// ── General API limiter ──────────────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,                  // 200 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    return ApiResponse.error(res, {
      statusCode: 429,
      message: "Too many requests. Please slow down.",
    });
  },
});

module.exports = { authLimiter, generalLimiter };

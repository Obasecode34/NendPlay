// src/middleware/auth.middleware.js
//
// This middleware guards protected routes.
// It extracts the access token from the Authorization header,
// verifies it, and attaches the decoded user info to req.user.
//
// Usage on any route: router.get("/me", authMiddleware, controller.getMe)
//
// The access token travels as: "Authorization: Bearer <token>"
// Short-lived (15min) — if expired, the frontend uses the refresh token endpoint.

const tokenService = require("../services/token.service");
const ApiResponse = require("../utils/apiResponse");

const authMiddleware = (req, res, next) => {
  try {
    // 1. Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return ApiResponse.unauthorized(res, "No token provided. Please log in.");
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      return ApiResponse.unauthorized(res, "Malformed authorization header");
    }

    // 2. Verify the token
    const { valid, decoded, error } = tokenService.verifyAccessToken(token);

    if (!valid) {
      // Specific message for expired tokens so frontend knows to refresh
      if (error === "jwt expired") {
        return ApiResponse.unauthorized(res, "Access token expired. Please refresh.");
      }
      return ApiResponse.unauthorized(res, "Invalid token");
    }

    // 3. Attach decoded payload to request — available in all downstream handlers
    req.user = decoded; // { userId, type, iat, exp }

    next();
  } catch (err) {
    console.error("Auth middleware error:", err);
    return ApiResponse.unauthorized(res, "Authentication failed");
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next();
    }

    const token = authHeader.split(" ")[1];
    if (!token) return next();

    const { valid, decoded } = tokenService.verifyAccessToken(token);
    if (valid) req.user = decoded;

    return next();
  } catch {
    return next();
  }
};

// Optional: middleware that checks if user is subscribed (for locked content)
// Will be fully used in Phase 2/4 but defined here for completeness
const requireSubscription = (req, res, next) => {
  // This will be fleshed out in Phase 4 (Subscription system)
  // For now it's a placeholder that always passes
  next();
};

const requireAdmin = (permission = null) => async (req, res, next) => {
  try {
    const User = require("../models/User");
    const user = await User.findById(req.user?.userId).select("role adminPermissions isActive");

    if (!user || !user.isActive) {
      return ApiResponse.unauthorized(res, "Admin account not found or inactive");
    }

    const role = user.role || "user";
    if (!["admin", "super_admin"].includes(role)) {
      return ApiResponse.forbidden(res, "Admin access required");
    }

    if (permission && role !== "super_admin" && !user.adminPermissions?.includes(permission)) {
      return ApiResponse.forbidden(res, `Missing admin permission: ${permission}`);
    }

    req.admin = {
      id: user._id,
      role,
      permissions: user.adminPermissions || [],
    };
    next();
  } catch (err) {
    console.error("Admin middleware error:", err);
    return ApiResponse.unauthorized(res, "Admin authentication failed");
  }
};

module.exports = { authMiddleware, optionalAuthMiddleware, requireSubscription, requireAdmin };

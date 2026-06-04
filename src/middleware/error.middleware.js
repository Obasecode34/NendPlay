// src/middleware/error.middleware.js
//
// Express's global error handler — catches anything that falls through
// with next(err). The 4-parameter signature is mandatory for Express
// to recognize this as an error handler.
//
// This is the safety net at the bottom of the stack.
// Every unhandled error eventually lands here.

const ApiResponse = require("../utils/apiResponse");
const { NODE_ENV } = require("../config/env");

const errorMiddleware = (err, req, res, next) => {
  // Log the full error in development for debugging
  if (NODE_ENV === "development") {
    console.error("\n❌  Unhandled Error:");
    console.error(err);
  }

  // Mongoose CastError (e.g. invalid ObjectId in URL param)
  if (err.name === "CastError" && err.kind === "ObjectId") {
    return ApiResponse.badRequest(res, "Invalid ID format");
  }

  // Mongoose ValidationError
  if (err.name === "ValidationError") {
    const messages = Object.values(err.errors).map((e) => e.message);
    return ApiResponse.badRequest(res, "Validation failed", messages);
  }

  // MongoDB duplicate key error (e.g. duplicate email/username)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || "field";
    return ApiResponse.error(res, {
      statusCode: 409,
      message: `${field} already in use`,
    });
  }

  // JWT errors (shouldn't reach here normally, caught in middleware)
  if (err.name === "JsonWebTokenError") {
    return ApiResponse.unauthorized(res, "Invalid token");
  }
  if (err.name === "TokenExpiredError") {
    return ApiResponse.unauthorized(res, "Token expired");
  }

  // Custom errors thrown by services with { status, message }
  if (err.status) {
    return ApiResponse.error(res, { statusCode: err.status, message: err.message });
  }

  // Default: unknown server error
  // In production, don't leak internal error details
  const message =
    NODE_ENV === "development"
      ? err.message
      : "Internal server error";

  return ApiResponse.error(res, { statusCode: 500, message });
};

// 404 handler — routes that don't exist
const notFoundMiddleware = (req, res) => {
  return ApiResponse.notFound(res, `Route ${req.method} ${req.path} not found`);
};

module.exports = { errorMiddleware, notFoundMiddleware };

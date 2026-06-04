// src/config/env.js
require("dotenv").config();

const required = [
  "MONGODB_URI",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "CLIENT_URL",
];

required.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌  Missing required environment variable: ${key}`);
    console.error(`    Check your .env file (see .env.example)`);
    process.exit(1);
  }
});

const optional = [
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
  "PAYSTACK_SECRET_KEY",
  "FLUTTERWAVE_SECRET_KEY",
  "RESEND_API_KEY",
  "NEWS_API_KEY",
];

optional.forEach((key) => {
  if (!process.env[key]) {
    console.warn(`Optional environment variable not set: ${key}`);
  }
});

module.exports = {
  PORT: process.env.PORT || 5000,
  HOST: process.env.HOST || "0.0.0.0",
  NODE_ENV: process.env.NODE_ENV || "development",
  MONGODB_URI: process.env.MONGODB_URI,

  JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  JWT_ACCESS_EXPIRES_IN: process.env.JWT_ACCESS_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",

  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean)
    : ["http://localhost:5173", "http://localhost:8081"],

  COOKIE_SECURE: process.env.COOKIE_SECURE === "true",
  COOKIE_SAME_SITE: process.env.COOKIE_SAME_SITE || "lax",

  // Cloudinary
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,

  // Media limits
  MAX_VIDEO_SIZE_MB: parseInt(process.env.MAX_VIDEO_SIZE_MB) || 500,
  MAX_AUDIO_SIZE_MB: parseInt(process.env.MAX_AUDIO_SIZE_MB) || 50,
  MAX_IMAGE_SIZE_MB: parseInt(process.env.MAX_IMAGE_SIZE_MB) || 10,
  MAX_SHORT_DURATION_SECONDS: 180,

  // Video provider integration
  VIDEO_STORAGE_PROVIDER: process.env.VIDEO_STORAGE_PROVIDER || "cloudinary",
  VIDEO_FALLBACK_PROVIDER: process.env.VIDEO_FALLBACK_PROVIDER || "",
  DIRECT_UPLOAD_ENABLED: process.env.DIRECT_UPLOAD_ENABLED === "true",
  BUNNY_STREAM_LIBRARY_ID: process.env.BUNNY_STREAM_LIBRARY_ID || "",
  BUNNY_STREAM_API_KEY: process.env.BUNNY_STREAM_API_KEY || "",
  BUNNY_STREAM_HOSTNAME: process.env.BUNNY_STREAM_HOSTNAME || "",
  BUNNY_TUS_EXPIRATION_SECONDS: parseInt(process.env.BUNNY_TUS_EXPIRATION_SECONDS) || 86400,
  MUX_TOKEN_ID: process.env.MUX_TOKEN_ID || "",
  MUX_TOKEN_SECRET: process.env.MUX_TOKEN_SECRET || "",
  MUX_CORS_ORIGIN: process.env.MUX_CORS_ORIGIN || process.env.CLIENT_URL || "*",
  MUX_PLAYBACK_POLICY: process.env.MUX_PLAYBACK_POLICY || "public",
  MUX_VIDEO_QUALITY: process.env.MUX_VIDEO_QUALITY || "basic",

  // Daily news provider
  NEWS_API_KEY: process.env.NEWS_API_KEY || "",

  // Payment Gateways
  PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
  PAYSTACK_WEBHOOK_SECRET: process.env.PAYSTACK_WEBHOOK_SECRET || "",
  FLUTTERWAVE_SECRET_KEY: process.env.FLUTTERWAVE_SECRET_KEY,
  FLUTTERWAVE_WEBHOOK_SECRET: process.env.FLUTTERWAVE_WEBHOOK_SECRET || "",

  // Frontend URL (for payment redirects)
  CLIENT_URL: process.env.CLIENT_URL || "http://localhost:5173",
};

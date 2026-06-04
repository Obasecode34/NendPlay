// src/config/cloudinary.js
//
// Cloudinary is the cloud storage for all NendPlay media files.
// Think of it as a hard drive in the cloud that also:
//   - Transcodes videos automatically
//   - Generates thumbnails
//   - Streams via CDN (fast worldwide delivery)
//   - Handles image transformations
//
// You need a free Cloudinary account: https://cloudinary.com
// Get your credentials from: Dashboard → API Keys

const cloudinary = require("cloudinary").v2;
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = require("./env");

cloudinary.config({
  cloud_name: CLOUDINARY_CLOUD_NAME,
  api_key: CLOUDINARY_API_KEY,
  api_secret: CLOUDINARY_API_SECRET,
});

module.exports = cloudinary;

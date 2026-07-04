// src/middleware/documentUpload.middleware.js
//
// Multer config specifically for document uploads.
// Documents go to Cloudinary as resource_type: "raw"
// which means no transformation — stored as-is.
//
// Max document size: 50MB (covers most books and presentations)

const multer = require("multer");
const ApiResponse = require("../utils/apiResponse");

const MAX_DOC_SIZE_MB = 50;

// ── Allowed MIME types and their file type labels ─────────────────────────
const DOCUMENT_MIME_TYPES = {
  "application/pdf":                                                    "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/msword":                                                 "doc",
  "text/plain":                                                         "txt",
  "application/epub+zip":                                               "epub",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
  "application/vnd.ms-powerpoint":                                      "ppt",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":  "xlsx",
  "application/vnd.ms-excel":                                           "xls",
  "text/csv":                                                           "csv",
};

const THUMBNAIL_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

// ── Get file type label from MIME type ────────────────────────────────────
const getFileType = (mimeType) => {
  return DOCUMENT_MIME_TYPES[mimeType] || "other";
};

// ── Memory storage ─────────────────────────────────────────────────────────
const memoryStorage = multer.memoryStorage();

// ── Document upload ────────────────────────────────────────────────────────
const uploadDocument = multer({
  storage: memoryStorage,
  limits: {
    fileSize: MAX_DOC_SIZE_MB * 1024 * 1024,
    files: 2,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      if (THUMBNAIL_MIME_TYPES.has(file.mimetype)) return cb(null, true);
      return cb(new Error("Invalid thumbnail type. Use JPEG, PNG, or WebP."), false);
    }

    if (file.fieldname !== "document") {
      return cb(new Error("Unexpected upload field. Use 'document' and optional 'thumbnail'."), false);
    }

    const allowedTypes = Object.keys(DOCUMENT_MIME_TYPES);
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Invalid file type. Allowed: PDF, DOCX, DOC, TXT, EPUB, PPTX, PPT, XLSX, XLS, CSV"
        ),
        false
      );
    }
  },
});

// ── Multer error handler ──────────────────────────────────────────────────
const handleDocumentUploadError = (err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return ApiResponse.badRequest(
        res,
        `Document too large. Maximum size is ${MAX_DOC_SIZE_MB}MB.`
      );
    }
    return ApiResponse.badRequest(res, `Upload error: ${err.message}`);
  }
  if (err) {
    return ApiResponse.badRequest(res, err.message);
  }
  next();
};

module.exports = {
  uploadDocument,
  handleDocumentUploadError,
  getFileType,
  DOCUMENT_MIME_TYPES,
  THUMBNAIL_MIME_TYPES,
};

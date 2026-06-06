// src/services/document.service.js
//
// All NovelHub business logic lives here.
//
// Upload flow:
//   1. File buffer arrives from Multer
//   2. Streamed to Cloudinary as resource_type: "raw"
//   3. Cloudinary returns a secure URL
//   4. Document saved to MongoDB with that URL
//
// Fork flow:
//   1. User requests to fork document X
//   2. We create a NEW document record pointing to the same Cloudinary file
//   3. The new document has originalDocument = X and isFork = true
//   4. User now owns their own copy they can edit metadata on
//   5. Original document's forkCount is incremented
//
// We don't copy the actual file — both documents share the same Cloudinary URL.
// Storage efficient. Like a symbolic link in a filesystem.

const Document = require("../models/Document");
const cloudinary = require("../config/cloudinary");
const { getFileType } = require("../middleware/documentUpload.middleware");
const { NOVEL_GENRES, normalizeNovelGenre, isNovelGenre } = require("../config/novelGenres");
const { Readable } = require("stream");

const LICENSE_TYPES = new Set([
  "unknown",
  "public_domain",
  "cc0",
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
  "standard_license",
  "owned",
  "permission_granted",
]);

const ATTRIBUTION_LICENSES = new Set([
  "cc_by",
  "cc_by_sa",
  "cc_by_nc",
  "cc_by_nc_sa",
  "cc_by_nd",
  "cc_by_nc_nd",
]);

const parseBoolean = (value) => value === true || value === "true";

const parseRightsMetadata = (body = {}) => {
  const licenseType = LICENSE_TYPES.has(body.licenseType) ? body.licenseType : "unknown";
  const requiresAttribution =
    body.requiresAttribution !== undefined
      ? parseBoolean(body.requiresAttribution)
      : ATTRIBUTION_LICENSES.has(licenseType);

  return {
    licenseType,
    licenseUrl: body.licenseUrl || "",
    sourceUrl: body.sourceUrl || "",
    sourceName: body.sourceName || "",
    attributionText: body.attributionText || "",
    rightsSummary: body.rightsSummary || "",
    requiresAttribution,
  };
};

class DocumentService {
  // ── Upload document to Cloudinary ─────────────────────────────────────
  _uploadToCloudinary(buffer, options = {}) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: options.folder || "nendplay/documents",
          resource_type: "raw", // raw = no transformation, store as-is
          use_filename: true,
          unique_filename: true,
          overwrite: false,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );

      const readable = new Readable();
      readable.push(buffer);
      readable.push(null);
      readable.pipe(uploadStream);
    });
  }

  // ── Upload and create document ────────────────────────────────────────
  async uploadDocument({ file, body, userId }) {
    const {
      title,
      description,
      category,
      tags,
      genre,
      author,
    } = body;

    const fileType = getFileType(file.mimetype);
    if (fileType !== "pdf") {
      throw {
        status: 400,
        message: "NovelHub uploads currently accept PDF files only. Use NP Office for other document types.",
      };
    }

    // 1. Upload to Cloudinary
    let cloudinaryResult;
    try {
      cloudinaryResult = await this._uploadToCloudinary(file.buffer, {
        folder: "nendplay/documents",
      });
    } catch (err) {
      throw { status: 500, message: `Document upload failed: ${err.message}` };
    }

    // 2. Parse tags
    let parsedTags = [];
    if (tags) {
      parsedTags = Array.isArray(tags)
        ? tags
        : tags.split(",").map((t) => t.trim()).filter(Boolean);
    }

    // 3. Normalize category for NovelHub rails.
    const normalizedGenre = normalizeNovelGenre(genre || category);
    const normalizedTags = Array.from(new Set([normalizedGenre, ...parsedTags]));
    const rightsMetadata = parseRightsMetadata(body);

    // 4. Save to MongoDB
    const document = await Document.create({
      title,
      description: description || "",
      fileUrl: cloudinaryResult.secure_url,
      cloudinaryPublicId: cloudinaryResult.public_id,
      fileType,
      mimeType: file.mimetype,
      fileSize: cloudinaryResult.bytes || file.size || 0,
      category: normalizedGenre,
      tags: normalizedTags,
      genre: normalizedGenre,
      author: author || "",
      ...rightsMetadata,
      uploadedBy: userId,
      isFork: false,
      originalDocument: null,
    });

    return document;
  }

  // ── Get all documents with filters and pagination ─────────────────────
  async getAllDocuments({
    fileType,
    category,
    search,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  }) {
    const query = { isActive: true };

    if (fileType) query.fileType = fileType;
    if (category && isNovelGenre(category)) query.category = normalizeNovelGenre(category);
    if (search) query.$text = { $search: search };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === "asc" ? 1 : -1;

    const [documents, total] = await Promise.all([
      Document.find(query)
        .populate("uploadedBy", "profileName username profilePic")
        .populate("originalDocument", "title uploadedBy")
        .sort({ [sortBy]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Document.countDocuments(query),
    ]);

    return {
      documents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get single document by ID ─────────────────────────────────────────
  async getDocumentById(documentId) {
    const document = await Document.findById(documentId)
      .populate("uploadedBy", "profileName username profilePic")
      .populate("originalDocument", "title uploadedBy");

    if (!document || !document.isActive) {
      throw { status: 404, message: "Document not found" };
    }

    // Increment view count
    await Document.findByIdAndUpdate(documentId, { $inc: { viewCount: 1 } });

    return document;
  }

  // ── Fork a document ───────────────────────────────────────────────────
  // Creates a personal copy of an existing document.
  // The fork shares the same Cloudinary file — no duplication.
  async forkDocument(documentId, userId) {
    const original = await Document.findById(documentId);

    if (!original || !original.isActive) {
      throw { status: 404, message: "Document not found" };
    }

    // Check if user already forked this document
    const existingFork = await Document.findOne({
      originalDocument: documentId,
      uploadedBy: userId,
      isActive: true,
    });

    if (existingFork) {
      throw { status: 409, message: "You already have a copy of this document" };
    }

    // Create the fork — same file, new record, user owns it
    const fork = await Document.create({
      title: `${original.title} (My Copy)`,
      description: original.description,
      fileUrl: original.fileUrl, // same Cloudinary URL
      cloudinaryPublicId: original.cloudinaryPublicId,
      fileType: original.fileType,
      mimeType: original.mimeType,
      fileSize: original.fileSize,
      category: original.category,
      tags: [...original.tags],
      genre: original.genre,
      author: original.author,
      licenseType: original.licenseType || "unknown",
      licenseUrl: original.licenseUrl || "",
      sourceUrl: original.sourceUrl || "",
      sourceName: original.sourceName || "",
      attributionText: original.attributionText || "",
      rightsSummary: original.rightsSummary || "",
      requiresAttribution: original.requiresAttribution || false,
      isRightsVerified: original.isRightsVerified || false,
      rightsVerifiedAt: original.rightsVerifiedAt || null,
      uploadedBy: userId,
      isFork: true,
      originalDocument: original._id,
    });

    // Increment original's fork count
    await Document.findByIdAndUpdate(documentId, { $inc: { forkCount: 1 } });

    return fork;
  }

  // ── Update document metadata ──────────────────────────────────────────
  // Users can only edit their own documents (original or fork).
  // File content cannot be changed — only metadata.
  async updateDocument(documentId, userId, updates) {
    const document = await Document.findById(documentId);

    if (!document || !document.isActive) {
      throw { status: 404, message: "Document not found" };
    }

    if (document.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only edit your own documents" };
    }

    const allowedUpdates = [
      "title", "description", "category",
      "tags", "genre", "author", "licenseType", "licenseUrl",
      "sourceUrl", "sourceName", "attributionText", "rightsSummary",
      "requiresAttribution", "isRightsVerified", "rightsVerifiedAt",
    ];

    allowedUpdates.forEach((field) => {
      if (updates[field] !== undefined) {
        if (field === "tags" && typeof updates[field] === "string") {
          document[field] = updates[field]
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean);
        } else if (field === "category" || field === "genre") {
          document.category = normalizeNovelGenre(updates[field]);
          document.genre = document.category;
        } else if (field === "licenseType") {
          document[field] = LICENSE_TYPES.has(updates[field]) ? updates[field] : "unknown";
        } else if (["requiresAttribution", "isRightsVerified"].includes(field)) {
          document[field] = parseBoolean(updates[field]);
        } else if (field === "rightsVerifiedAt") {
          document[field] = updates[field] ? new Date(updates[field]) : null;
        } else {
          document[field] = updates[field];
        }
      }
    });

    await document.save();
    return document;
  }

  // ── Delete document ───────────────────────────────────────────────────
  async deleteDocument(documentId, userId) {
    const document = await Document.findById(documentId);

    if (!document || !document.isActive) {
      throw { status: 404, message: "Document not found" };
    }

    if (document.uploadedBy.toString() !== userId.toString()) {
      throw { status: 403, message: "You can only delete your own documents" };
    }

    // Soft delete
    document.isActive = false;
    await document.save();

    return { message: "Document deleted successfully" };
  }

  // ── Increment download count ──────────────────────────────────────────
  async recordDownload(documentId) {
    const document = await Document.findById(documentId);
    if (!document || !document.isActive) {
      throw { status: 404, message: "Document not found" };
    }
    await Document.findByIdAndUpdate(documentId, { $inc: { downloadCount: 1 } });
    return { fileUrl: document.fileUrl, title: document.title };
  }

  // ── Get documents by user ─────────────────────────────────────────────
  async getDocumentsByUser(userId, page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [documents, total] = await Promise.all([
      Document.find({ uploadedBy: userId, isActive: true })
        .populate("originalDocument", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Document.countDocuments({ uploadedBy: userId, isActive: true }),
    ]);

    return {
      documents,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Get all forks of a document ───────────────────────────────────────
  async getDocumentForks(documentId, page = 1, limit = 20) {
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [forks, total] = await Promise.all([
      Document.find({ originalDocument: documentId, isActive: true })
        .populate("uploadedBy", "profileName username profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Document.countDocuments({ originalDocument: documentId, isActive: true }),
    ]);

    return {
      forks,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  }

  // ── Like document ─────────────────────────────────────────────────────
  async likeDocument(documentId) {
    const document = await Document.findById(documentId);
    if (!document || !document.isActive) {
      throw { status: 404, message: "Document not found" };
    }
    await Document.findByIdAndUpdate(documentId, { $inc: { likeCount: 1 } });
    return { likeCount: document.likeCount + 1 };
  }

  getGenres() {
    return NOVEL_GENRES;
  }
}

module.exports = new DocumentService();

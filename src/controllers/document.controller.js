// src/controllers/document.controller.js
//
// Thin HTTP layer for NovelHub.
// All logic is in document.service.js.

const documentService = require("../services/document.service");
const ApiResponse = require("../utils/apiResponse");
const analyticsService = require("../services/analytics.service");

function trackRequestEvent(req, eventType, data = {}) {
  analyticsService.track({
    user: req.user,
    headers: req.headers,
    body: {
      eventType,
      platform: req.headers["x-client-platform"] || "unknown",
      ...data,
    },
  }).catch(() => {});
}

class DocumentController {
  // POST /api/novels/upload
  async uploadDocument(req, res) {
    try {
      if (!req.file) {
        return ApiResponse.badRequest(
          res,
          "No document file provided. Use field name 'document'."
        );
      }

      const document = await documentService.uploadDocument({
        file: req.file,
        body: req.body,
        userId: req.user.userId,
        user: req.user,
      });

      return ApiResponse.created(res, {
        message: "Document uploaded successfully",
        data: { document },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      console.error("Document upload error:", err);
      return ApiResponse.error(res, {
        statusCode: 500,
        message: err.message || "Upload failed. Please try again.",
      });
    }
  }

  // GET /api/novels
  async getAllDocuments(req, res) {
    try {
      const {
        fileType, category, search,
        page, limit, sortBy, sortOrder,
      } = req.query;

      const result = await documentService.getAllDocuments({
        fileType, category, search,
        page, limit, sortBy, sortOrder,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/novels/genres
  async getGenres(req, res) {
    return ApiResponse.success(res, {
      data: { genres: documentService.getGenres() },
    });
  }

  // GET /api/novels/:id
  async getDocumentById(req, res) {
    try {
      const document = await documentService.getDocumentById(req.params.id);
      trackRequestEvent(req, "novel_read", {
        screen: "novelhub",
        contentType: "document",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: { document } });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/novels/:id/fork
  async forkDocument(req, res) {
    try {
      const fork = await documentService.forkDocument(
        req.params.id,
        req.user.userId
      );

      return ApiResponse.created(res, {
        message: "Document forked successfully. You now have your own copy.",
        data: { document: fork },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/novels/:id
  async updateDocument(req, res) {
    try {
      const document = await documentService.updateDocument(
        req.params.id,
        req.user.userId,
        req.body
      );

      return ApiResponse.success(res, {
        message: "Document updated successfully",
        data: { document },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // DELETE /api/novels/:id
  async deleteDocument(req, res) {
    try {
      const result = await documentService.deleteDocument(
        req.params.id,
        req.user.userId
      );
      return ApiResponse.success(res, { message: result.message });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/novels/:id/download
  // Records the download and returns the file URL
  async downloadDocument(req, res) {
    try {
      const result = await documentService.recordDownload(req.params.id);
      trackRequestEvent(req, "download", {
        screen: "novelhub_downloads",
        contentType: "document",
        contentId: req.params.id,
      });

      // Return the direct Cloudinary URL — frontend redirects to it
      return ApiResponse.success(res, {
        message: "Download ready",
        data: {
          fileUrl: result.fileUrl,
          title: result.title,
        },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/novels/:id/like
  async likeDocument(req, res) {
    try {
      const result = await documentService.likeDocument(req.params.id);
      trackRequestEvent(req, "like", {
        screen: "novelhub",
        contentType: "document",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, {
          statusCode: err.status,
          message: err.message,
        });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/novels/user/:userId
  async getDocumentsByUser(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await documentService.getDocumentsByUser(
        req.params.userId,
        page,
        limit
      );
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/novels/:id/forks
  async getDocumentForks(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await documentService.getDocumentForks(
        req.params.id,
        page,
        limit
      );
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }
}

module.exports = new DocumentController();

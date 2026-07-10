// src/controllers/media.controller.js
//
// Thin HTTP layer. Extracts request data, calls service, sends response.
// The streaming endpoint (streamMedia) is more complex —
// it implements HTTP Range Requests for seek/resume support.

const mediaService = require("../services/media.service");
const Media = require("../models/Media");
const ApiResponse = require("../utils/apiResponse");
const axios = require("axios");
const analyticsService = require("../services/analytics.service");

const BUNNY_REFERER = process.env.BUNNY_STREAM_REFERER || "https://nendplay.com";

const isPlaylistPath = (value = "") => value.includes(".m3u8");

function getBunnyProxyHeaders() {
  return {
    Referer: `${BUNNY_REFERER.replace(/\/+$/, "")}/`,
    Origin: BUNNY_REFERER.replace(/\/+$/, ""),
    "User-Agent": "Mozilla/5.0 NendPlayMedia/1.0",
  };
}

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

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const proto = forwardedProto || req.protocol || "https";
  const host = forwardedHost || req.get("host");
  return `${proto}://${host}`.replace(/\/+$/, "");
}

function rewriteHlsPlaylist({ playlist, mediaId, playbackToken, currentPath = "", requestOrigin = "" }) {
  const baseDir = currentPath.includes("/")
    ? currentPath.split("/").slice(0, -1).join("/")
    : "";

  return playlist
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;

      const params = new URLSearchParams({ playbackToken });
      if (/^https?:\/\//i.test(trimmed)) {
        params.set("url", trimmed);
      } else {
        const nextPath = baseDir ? `${baseDir}/${trimmed}` : trimmed;
        params.set("path", nextPath);
      }
      const proxyPath = `/api/media/${mediaId}/hls?${params.toString()}`;
      return requestOrigin ? `${requestOrigin}${proxyPath}` : proxyPath;
    })
    .join("\n");
}

function resolveHlsTargetUrl({ sourceUrl, path = "", absoluteUrl = "" }) {
  const source = new URL(sourceUrl);
  if (absoluteUrl) {
    const target = new URL(absoluteUrl);
    if (target.host !== source.host) {
      throw { status: 400, message: "Invalid HLS host" };
    }
    return target.toString();
  }

  const cleanPath = String(path || "").replace(/^\/+/, "");
  if (!cleanPath || cleanPath.includes("..")) {
    throw { status: 400, message: "Invalid HLS path" };
  }
  const sourceDir = source.pathname.split("/").slice(0, -1).join("/");
  const sourceDirWithoutSlash = sourceDir.replace(/^\/+/, "");
  source.pathname = cleanPath.startsWith(`${sourceDirWithoutSlash}/`)
    ? `/${cleanPath}`
    : `${sourceDir}/${cleanPath}`;
  return source.toString();
}

class MediaController {
  // POST /api/media/upload
  async uploadMedia(req, res) {
    try {
      if (!req.files || !req.files.media || !req.files.media[0]) {
        return ApiResponse.badRequest(res, "No media file provided. Use field name 'media'.");
      }

      const mediaFile = req.files.media[0];
      const thumbnailFile = req.files.thumbnail ? req.files.thumbnail[0] : null;

      const media = await mediaService.uploadMedia({
        mediaFile,
        thumbnailFile,
        body: req.body,
        userId: req.user.userId,
        user: req.user,
      });

      return ApiResponse.created(res, {
        message: "Media uploaded successfully",
        data: { media },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Upload error:", err);
      return ApiResponse.error(res, { message: "Upload failed. Please try again." });
    }
  }

  // POST /api/media/upload-session
  // Provider-ready handshake for future direct uploads (S3/R2/Bunny/Mux).
  async createUploadSession(req, res) {
    try {
      const session = await mediaService.createUploadSession({
        body: req.body,
        userId: req.user.userId,
      });

      return ApiResponse.success(res, {
        message: "Upload session prepared",
        data: { session },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/external
  // Completes a direct/provider upload by saving playback metadata.
  async completeExternalUpload(req, res) {
    try {
      const provider = req.body.storageProvider || req.body.provider;
      let result;

      if (provider === "bunny") {
        result = await mediaService.registerBunnyUpload({ body: req.body, userId: req.user.userId, user: req.user });
      } else if (provider === "mux") {
        result = await mediaService.registerMuxUpload({ body: req.body, userId: req.user.userId, user: req.user });
      } else {
        result = {
          media: await mediaService.completeExternalUpload({
            body: req.body,
            userId: req.user.userId,
            user: req.user,
          }),
        };
      }

      return ApiResponse.created(res, {
        message: "External media registered successfully",
        data: result,
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("External upload completion error:", err);
      return ApiResponse.error(res, { message: "External upload completion failed" });
    }
  }

  async syncBunnyMedia(req, res) {
    try {
      const media = await mediaService.syncBunnyMedia(req.params.id, req.user.userId);
      return ApiResponse.success(res, {
        message: "Bunny media synced",
        data: { media },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Bunny sync failed" });
    }
  }

  async syncMuxMedia(req, res) {
    try {
      const media = await mediaService.syncMuxMedia(req.params.id, req.user.userId);
      return ApiResponse.success(res, {
        message: "Mux media synced",
        data: { media },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Mux sync failed" });
    }
  }

  // GET /api/media — get all media with optional filters
  async getAllMedia(req, res) {
    try {
      const {
        type, category, isLocked, isShort, isLive,
        search, page, limit, sortBy, sortOrder,
        language, country, homeSection, publishStatus,
      } = req.query;

      const result = await mediaService.getAllMedia({
        type, category, isLocked, isShort, isLive,
        search, page, limit, sortBy, sortOrder,
        language, country, homeSection, publishStatus,
      });

      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/:id
  async getMediaById(req, res) {
    try {
      const media = await mediaService.getMediaById(req.params.id);
      trackRequestEvent(req, "screen_view", {
        screen: "media_detail",
        contentType: "media",
        contentId: req.params.id,
      });

      // Check if media is locked and user is not subscribed
      // Full subscription check comes in Phase 4 — for now return the media
      // with a flag so frontend can decide what to show
      const canPlay = await mediaService.canUserAccessMedia(media, req.user?.userId);

      if (media.isLocked && !canPlay) {
        return ApiResponse.success(res, {
          data: {
            media: {
              _id: media._id,
              title: media.title,
              description: media.description,
              thumbnailUrl: media.thumbnailUrl,
              type: media.type,
              duration: media.duration,
              isLocked: true,
              uploadedBy: media.uploadedBy,
              createdAt: media.createdAt,
            },
            locked: true,
            message: "Subscribe to access this content",
          },
        });
      }

      return ApiResponse.success(res, { data: { media, locked: false } });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/:id/playback
  // Returns a short-lived on-demand playback manifest for approved media.
  async getPlayback(req, res) {
    try {
      const manifest = await mediaService.getPlaybackManifest(req.params.id, req.user?.userId);
      trackRequestEvent(req, "media_watch", {
        screen: "media_player",
        contentType: "media",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: { playback: manifest } });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Playback manifest failed" });
    }
  }

  async thumbnailMedia(req, res) {
    try {
      const media = await Media.findById(req.params.id)
        .select("thumbnailUrl isActive publishStatus storageProvider")
        .lean();

      if (!media || !media.isActive || (media.publishStatus && media.publishStatus !== "published")) {
        return ApiResponse.notFound(res, "Thumbnail not found");
      }

      if (!media.thumbnailUrl) {
        return ApiResponse.notFound(res, "Thumbnail not found");
      }

      const response = await axios.get(media.thumbnailUrl, {
        responseType: "stream",
        headers: media.storageProvider === "bunny" ? getBunnyProxyHeaders() : undefined,
        timeout: 20000,
      });

      res.setHeader("Content-Type", response.headers["content-type"] || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      return response.data.pipe(res);
    } catch (err) {
      console.warn(`Thumbnail proxy failed for ${req.params.id}: ${err.message}`);
      return ApiResponse.notFound(res, "Thumbnail not found");
    }
  }

  // GET /api/media/:id/stream
  // HTTP Range Request streaming — enables seek, pause, resume
  // This is the core of the streaming system.
  //
  // How it works (physics analogy):
  // Think of the video file as a ruler.
  // The client says "give me bytes 0 to 1048576" (first chunk).
  // Server responds with just that slice, status 206 (Partial Content).
  // Client plays that chunk, then asks for the next slice.
  // This is why you can seek to any point without downloading the whole file.
  async streamMedia(req, res) {
    try {
      const media = await mediaService.getMediaById(req.params.id);
      const playbackToken = req.query.playbackToken || req.query.token;
      const decodedPlayback = mediaService.verifyPlaybackToken(playbackToken, media._id);
      const tokenUserId = decodedPlayback?.userId || req.user?.userId || null;
      const canPlay = decodedPlayback
        ? await mediaService.canUserAccessMedia(media, tokenUserId)
        : await mediaService.canUserAccessMedia(media, req.user?.userId);

      if (!canPlay) {
        return ApiResponse.unauthorized(res, "Subscribe to access this stream");
      }

      const sourceUrl = mediaService.getBestPlaybackUrl(media);

      if (!sourceUrl) {
        return ApiResponse.notFound(res, "Media file not found");
      }

      if (sourceUrl.includes(".m3u8")) {
        if (media.storageProvider === "bunny") {
          try {
            const response = await axios.get(sourceUrl, {
              headers: getBunnyProxyHeaders(),
              responseType: "text",
            });
            res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
            res.setHeader("Cache-Control", "private, max-age=30");
            return res.send(rewriteHlsPlaylist({
              playlist: response.data,
              mediaId: media._id,
              playbackToken,
              requestOrigin: getRequestOrigin(req),
            }));
          } catch (err) {
            return ApiResponse.error(res, { message: "Bunny playlist unavailable" });
          }
        }

        return res.redirect(sourceUrl);
      }

      // For Cloudinary-hosted files, proxy the stream through our server
      // with Range header support
      const range = req.headers.range;

      if (!range) {
        // No range header — stream entire file (for audio players, etc.)
        res.setHeader("Content-Type", media.mimeType || "video/mp4");
        res.setHeader("Accept-Ranges", "bytes");

        try {
          const response = await axios({
            method: "GET",
            url: sourceUrl,
            responseType: "stream",
          });
          res.setHeader("Content-Length", response.headers["content-length"] || "");
          response.data.pipe(res);
        } catch (streamErr) {
          return ApiResponse.error(res, { message: "Streaming failed" });
        }
        return;
      }

      // Parse the Range header: "bytes=start-end"
      const fileSize = Number(media.fileSize);
      if (!Number.isFinite(fileSize) || fileSize <= 0) {
        try {
          const response = await axios({
            method: "GET",
            url: sourceUrl,
            responseType: "stream",
            headers: { Range: range },
            validateStatus: (status) => status >= 200 && status < 300,
          });

          res.status(response.status === 206 ? 206 : 200);
          res.setHeader("Content-Type", response.headers["content-type"] || media.mimeType || "video/mp4");
          res.setHeader("Accept-Ranges", response.headers["accept-ranges"] || "bytes");
          if (response.headers["content-range"]) {
            res.setHeader("Content-Range", response.headers["content-range"]);
          }
          if (response.headers["content-length"]) {
            res.setHeader("Content-Length", response.headers["content-length"]);
          }
          return response.data.pipe(res);
        } catch (streamErr) {
          console.error("Range passthrough stream error:", streamErr.message);
          return res.end();
        }
      }
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunkSize = end - start + 1;

      // Respond with 206 Partial Content
      res.writeHead(206, {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": chunkSize,
        "Content-Type": media.mimeType || "video/mp4",
      });

      // Fetch the specific byte range from Cloudinary and pipe to client
      try {
        const response = await axios({
          method: "GET",
          url: sourceUrl,
          responseType: "stream",
          headers: { Range: `bytes=${start}-${end}` },
        });
        response.data.pipe(res);
      } catch (streamErr) {
        console.error("Range stream error:", streamErr.message);
        return res.end();
      }
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  async proxyHlsMedia(req, res) {
    try {
      const media = await mediaService.getMediaById(req.params.id);
      const playbackToken = req.query.playbackToken || req.query.token;
      const decodedPlayback = mediaService.verifyPlaybackToken(playbackToken, media._id);
      const tokenUserId = decodedPlayback?.userId || req.user?.userId || null;
      const canPlay = decodedPlayback
        ? await mediaService.canUserAccessMedia(media, tokenUserId)
        : await mediaService.canUserAccessMedia(media, req.user?.userId);

      if (!canPlay) {
        return ApiResponse.unauthorized(res, "Subscribe to access this stream");
      }

      if (media.storageProvider !== "bunny") {
        return ApiResponse.badRequest(res, "HLS proxy is only available for Bunny media");
      }

      const sourceUrl = mediaService.getBestPlaybackUrl(media);
      if (!sourceUrl) {
        return ApiResponse.notFound(res, "Media file not found");
      }

      const path = String(req.query.path || "").replace(/^\/+/, "");
      const absoluteUrl = String(req.query.url || "");
      const targetUrl = resolveHlsTargetUrl({ sourceUrl, path, absoluteUrl });
      const targetIsPlaylist = isPlaylistPath(targetUrl);

      const response = await axios.get(targetUrl, {
        headers: getBunnyProxyHeaders(),
        responseType: targetIsPlaylist ? "text" : "stream",
      });

      if (targetIsPlaylist) {
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        res.setHeader("Cache-Control", "private, max-age=30");
        return res.send(rewriteHlsPlaylist({
          playlist: response.data,
          mediaId: media._id,
          playbackToken,
          currentPath: path || new URL(absoluteUrl).pathname.replace(/^\/+/, ""),
          requestOrigin: getRequestOrigin(req),
        }));
      }

      res.setHeader("Content-Type", response.headers["content-type"] || "video/mp2t");
      res.setHeader("Cache-Control", "private, max-age=300");
      if (response.headers["content-length"]) {
        res.setHeader("Content-Length", response.headers["content-length"]);
      }
      return response.data.pipe(res);
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "HLS proxy failed" });
    }
  }

  // PATCH /api/media/:id
  async updateMedia(req, res) {
    try {
      const media = await mediaService.updateMedia(
        req.params.id,
        req.user.userId,
        req.body
      );
      return ApiResponse.success(res, {
        message: "Media updated successfully",
        data: { media },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // DELETE /api/media/:id
  async deleteMedia(req, res) {
    try {
      const result = await mediaService.deleteMedia(req.params.id, req.user.userId);
      return ApiResponse.success(res, { message: result.message });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/:id/like
  async likeMedia(req, res) {
    try {
      const result = await mediaService.toggleLike(req.params.id);
      trackRequestEvent(req, "like", {
        screen: "media",
        contentType: "media",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/:id/dislike
  async dislikeMedia(req, res) {
    try {
      const result = await mediaService.toggleDislike(req.params.id);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/:id/comment
  async commentMedia(req, res) {
    try {
      const { text } = req.body;
      if (!text || !text.trim()) {
        return ApiResponse.badRequest(res, "Comment text is required");
      }
      const result = await mediaService.addComment(req.params.id, req.user.userId, text);
      trackRequestEvent(req, "comment", {
        screen: "media",
        contentType: "media",
        contentId: req.params.id,
      });
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/:id/save
  async saveMedia(req, res) {
    try {
      const result = await mediaService.toggleSave(req.params.id, req.user.userId);
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/creators/:creatorId/subscribe
  async subscribeCreator(req, res) {
    try {
      const result = await mediaService.toggleCreatorSubscription(
        req.params.creatorId,
        req.user.userId
      );
      return ApiResponse.success(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // POST /api/media/:id/remix
  async remixMedia(req, res) {
    try {
      const result = await mediaService.remixMedia(req.params.id, req.user.userId, req.body);
      return ApiResponse.created(res, { message: result.message, data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/saved
  async getSavedMedia(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await mediaService.getSavedMedia(req.user.userId, page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/shorts
  async getShorts(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await mediaService.getShorts(page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/shorts/subscribed
  async getSubscribedShorts(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await mediaService.getSubscribedShorts(req.user.userId, page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/live
  async getLiveEvents(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await mediaService.getLiveEvents(page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }

  // GET /api/media/user/:userId
  async getMediaByUser(req, res) {
    try {
      const { page, limit } = req.query;
      const result = await mediaService.getMediaByUser(req.params.userId, page, limit);
      return ApiResponse.success(res, { data: result });
    } catch (err) {
      return ApiResponse.error(res);
    }
  }
}

module.exports = new MediaController();

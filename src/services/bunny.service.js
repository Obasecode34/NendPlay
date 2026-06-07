const axios = require("axios");
const crypto = require("crypto");
const {
  BUNNY_STREAM_LIBRARY_ID,
  BUNNY_STREAM_API_KEY,
  BUNNY_STREAM_HOSTNAME,
  BUNNY_TUS_EXPIRATION_SECONDS,
} = require("../config/env");

const TUS_UPLOAD_URL = "https://video.bunnycdn.com/tusupload";

class BunnyService {
  constructor() {
    this.libraryId = BUNNY_STREAM_LIBRARY_ID;
    this.apiKey = BUNNY_STREAM_API_KEY;
    this.hostname = this.normalizeHostname(BUNNY_STREAM_HOSTNAME);
    this.client = axios.create({
      baseURL: this.libraryId
        ? `https://video.bunnycdn.com/library/${this.libraryId}`
        : "https://video.bunnycdn.com/library",
      headers: {
        AccessKey: this.apiKey,
        "Content-Type": "application/json",
      },
      timeout: 20000,
    });
  }

  get isConfigured() {
    return Boolean(this.libraryId && this.apiKey && this.hostname);
  }

  normalizeHostname(hostname) {
    return `${hostname || ""}`.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  }

  ensureConfigured() {
    if (!this.isConfigured) {
      throw {
        status: 500,
        message: "Bunny Stream is not configured. Add BUNNY_STREAM_LIBRARY_ID, BUNNY_STREAM_API_KEY, and BUNNY_STREAM_HOSTNAME.",
      };
    }
  }

  async createVideo({ title }) {
    this.ensureConfigured();
    const { data } = await this.client.post("/videos", {
      title: title || `NendPlay upload ${Date.now()}`,
    });
    return data;
  }

  createTusHeaders(videoId) {
    this.ensureConfigured();
    const expiresAt = Math.floor(Date.now() / 1000) + BUNNY_TUS_EXPIRATION_SECONDS;
    const signature = crypto
      .createHash("sha256")
      .update(`${this.libraryId}${this.apiKey}${expiresAt}${videoId}`)
      .digest("hex");

    return {
      headers: {
        AuthorizationSignature: signature,
        AuthorizationExpire: `${expiresAt}`,
        VideoId: videoId,
        LibraryId: `${this.libraryId}`,
      },
      expiresAt: new Date(expiresAt * 1000),
    };
  }

  async createDirectUpload({ title }) {
    const video = await this.createVideo({ title });
    const videoId = video.guid || video.id;
    const auth = this.createTusHeaders(videoId);

    return {
      video,
      uploadUrl: TUS_UPLOAD_URL,
      ...auth,
      ...this.getPlayback(videoId),
    };
  }

  async getVideo(videoId) {
    this.ensureConfigured();
    const { data } = await this.client.get(`/videos/${videoId}`);
    return data;
  }

  async listVideos({ page = 1, itemsPerPage = 100, search = "" } = {}) {
    this.ensureConfigured();
    const { data } = await this.client.get("/videos", {
      params: {
        page,
        itemsPerPage,
        search: search || undefined,
      },
    });

    const items = data.items || data.videos || [];
    return {
      items,
      totalItems: data.totalItems || data.total || items.length,
      currentPage: data.currentPage || page,
      itemsPerPage: data.itemsPerPage || itemsPerPage,
      raw: data,
    };
  }

  async deleteVideo(videoId) {
    this.ensureConfigured();
    if (!videoId) return null;
    const { data } = await this.client.delete(`/videos/${videoId}`);
    return data;
  }

  getPlayback(videoId) {
    const baseUrl = this.hostname ? `https://${this.hostname}/${videoId}` : "";
    return {
      playbackUrl: baseUrl ? `${baseUrl}/playlist.m3u8` : "",
      hlsUrl: baseUrl ? `${baseUrl}/playlist.m3u8` : "",
      thumbnailUrl: baseUrl ? `${baseUrl}/thumbnail.jpg` : "",
    };
  }

  getProcessingStatus(video = {}) {
    const status = `${video.status ?? video.encodeProgress ?? ""}`.toLowerCase();
    if (video.status === 4 || status === "finished" || status === "ready") {
      return "ready";
    }
    if (video.status === 5 || status === "failed" || status === "error") {
      return "failed";
    }
    return "processing";
  }
}

module.exports = new BunnyService();

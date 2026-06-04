const axios = require("axios");
const {
  MUX_TOKEN_ID,
  MUX_TOKEN_SECRET,
  MUX_CORS_ORIGIN,
  MUX_PLAYBACK_POLICY,
  MUX_VIDEO_QUALITY,
} = require("../config/env");

const MUX_API_BASE = "https://api.mux.com/video/v1";

class MuxService {
  get enabled() {
    return Boolean(MUX_TOKEN_ID && MUX_TOKEN_SECRET);
  }

  get client() {
    if (!this.enabled) {
      throw { status: 500, message: "Mux credentials are not configured" };
    }
    return axios.create({
      baseURL: MUX_API_BASE,
      auth: {
        username: MUX_TOKEN_ID,
        password: MUX_TOKEN_SECRET,
      },
      headers: { "Content-Type": "application/json" },
    });
  }

  async createDirectUpload({ passthrough, corsOrigin } = {}) {
    const response = await this.client.post("/uploads", {
      cors_origin: corsOrigin || MUX_CORS_ORIGIN || "*",
      timeout: 3600,
      new_asset_settings: {
        playback_policies: [MUX_PLAYBACK_POLICY || "public"],
        video_quality: MUX_VIDEO_QUALITY || "basic",
        passthrough,
      },
    });

    return response.data.data;
  }

  async getDirectUpload(uploadId) {
    const response = await this.client.get(`/uploads/${uploadId}`);
    return response.data.data;
  }

  async getAsset(assetId) {
    const response = await this.client.get(`/assets/${assetId}`);
    return response.data.data;
  }

  getPlayback(playbackIds = []) {
    const playbackId = playbackIds.find((item) => item.policy === "public")?.id || playbackIds[0]?.id || "";
    if (!playbackId) {
      return { playbackId: "", hlsUrl: "", playbackUrl: "" };
    }
    return {
      playbackId,
      hlsUrl: `https://stream.mux.com/${playbackId}.m3u8`,
      playbackUrl: `https://stream.mux.com/${playbackId}.m3u8`,
    };
  }
}

module.exports = new MuxService();

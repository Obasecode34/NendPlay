const cloudinaryService = require("./cloudinary.service");
const bunnyService = require("./bunny.service");
const muxService = require("./mux.service");

function getMuxPlaybackIdFromUrl(url = "") {
  const match = String(url).match(/stream\.mux\.com\/([^/?#]+)\.m3u8/i);
  return match?.[1] || "";
}

class MediaThumbnailService {
  async resolveGeneratedThumbnailUrl(media = {}) {
    if (media.thumbnailUrl) return media.thumbnailUrl;

    if (media.storageProvider === "cloudinary" && media.cloudinaryPublicId) {
      return cloudinaryService.getVideoThumbnailUrl(media.cloudinaryPublicId);
    }

    if (media.storageProvider === "bunny" && media.storageKey) {
      const playback = bunnyService.getPlayback(media.storageKey);
      return playback.thumbnailUrl || "";
    }

    if (media.storageProvider === "mux") {
      const playbackId = getMuxPlaybackIdFromUrl(media.hlsUrl || media.playbackUrl || media.mediaUrl);
      if (playbackId) {
        return `https://image.mux.com/${playbackId}/thumbnail.jpg?time=1`;
      }

      if (media.storageKey && muxService.enabled) {
        try {
          const asset = await muxService.getAsset(media.storageKey);
          const playback = muxService.getPlayback(asset.playback_ids || []);
          return playback.thumbnailUrl || "";
        } catch (err) {
          console.warn(`Mux thumbnail lookup skipped for ${media.storageKey}: ${err.message}`);
        }
      }
    }

    return "";
  }

  async ensureGeneratedThumbnail(media) {
    if (!media || media.thumbnailUrl) return media;

    const thumbnailUrl = await this.resolveGeneratedThumbnailUrl(media);
    if (!thumbnailUrl) return media;

    media.thumbnailUrl = thumbnailUrl;
    if (typeof media.save === "function") {
      await media.save();
    }
    return media;
  }
}

module.exports = new MediaThumbnailService();

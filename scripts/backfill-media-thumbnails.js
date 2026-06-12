require("dotenv").config();

const mongoose = require("mongoose");
const Media = require("../src/models/Media");
const mediaThumbnailService = require("../src/services/mediaThumbnail.service");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const force = process.argv.includes("--force");

  const missingThumbnailFilter = {
    $or: [
      { thumbnailUrl: { $exists: false } },
      { thumbnailUrl: null },
      { thumbnailUrl: "" },
    ],
  };
  const [totalMedia, missingThumbnails, existingThumbnails] = await Promise.all([
    Media.countDocuments(),
    Media.countDocuments(missingThumbnailFilter),
    Media.countDocuments({
      thumbnailUrl: { $nin: [null, ""] },
    }),
  ]);
  const mediaItems = await Media.find(force ? {} : missingThumbnailFilter);

  let fixed = 0;
  let skipped = 0;
  let preserved = 0;

  for (const media of mediaItems) {
    const before = media.thumbnailUrl || "";

    if (force && before && media.thumbnailCloudinaryId) {
      preserved += 1;
      continue;
    }

    if (force && before) {
      const generatedThumbnailUrl = await mediaThumbnailService.resolveGeneratedThumbnailUrl({
        ...media.toObject(),
        thumbnailUrl: "",
      });
      if (generatedThumbnailUrl && generatedThumbnailUrl !== before) {
        media.thumbnailUrl = generatedThumbnailUrl;
        await media.save();
      }
    } else {
      await mediaThumbnailService.ensureGeneratedThumbnail(media);
    }

    if ((!before && media.thumbnailUrl) || (force && before && media.thumbnailUrl !== before)) {
      fixed += 1;
    } else {
      skipped += 1;
    }
  }

  console.log(
    [
      `Total media records: ${totalMedia}.`,
      `Existing thumbnails: ${existingThumbnails}.`,
      `Missing thumbnails: ${missingThumbnails}.`,
      `Scanned ${mediaItems.length} media record(s).`,
      `Generated or updated ${fixed}.`,
      `Skipped ${skipped}.`,
      `Preserved custom thumbnails ${preserved}.`,
      force ? "Force mode was enabled." : "Run with -- --force to regenerate provider thumbnails that already have a URL.",
    ].join(" ")
  );
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

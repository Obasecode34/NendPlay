require("dotenv").config();

const mongoose = require("mongoose");
const Media = require("../src/models/Media");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const legacyFilter = {
    isActive: true,
    $or: [
      { publishStatus: { $exists: false } },
      { publishStatus: null },
      { publishStatus: "" },
    ],
  };

  const result = await Media.updateMany(legacyFilter, {
    $set: {
      publishStatus: "published",
      reviewStatus: "approved",
      reviewedAt: new Date(),
      reviewNote: "Backfilled active media that existed before admin approval workflow.",
    },
  });

  console.log(`Backfilled ${result.modifiedCount || 0} legacy media record(s).`);
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

require("dotenv").config();

const mongoose = require("mongoose");
const Media = require("../src/models/Media");

const MEDIA_TEXT_INDEX = {
  title: "text",
  description: "text",
  tags: "text",
  artist: "text",
  genre: "text",
  category: "text",
  language: "text",
  country: "text",
  homeSections: "text",
  licenseType: "text",
  sourceName: "text",
  attributionText: "text",
};

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const collection = Media.collection;
  const indexes = await collection.indexes();
  const textIndexes = indexes.filter((index) =>
    Object.values(index.key || {}).includes("text")
  );

  for (const index of textIndexes) {
    await collection.dropIndex(index.name);
    console.log(`Dropped text index: ${index.name}`);
  }

  await collection.createIndex(MEDIA_TEXT_INDEX, {
    name: "media_text_search",
    default_language: "none",
    language_override: "__textSearchLanguage",
  });
  console.log("Created media_text_search with safe language override.");
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });

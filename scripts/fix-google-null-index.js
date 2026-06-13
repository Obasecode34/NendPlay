require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const result = await User.updateMany(
    { googleId: null },
    { $unset: { googleId: "" } }
  );

  console.log(`Unset null googleId on ${result.modifiedCount || 0} user record(s).`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

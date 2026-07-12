require("dotenv").config();
const mongoose = require("mongoose");
const Referral = require("../src/models/Referral");
const User = require("../src/models/User");

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required");
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const counts = await Referral.aggregate([
    { $group: { _id: "$referrerId", count: { $sum: 1 } } },
  ]);

  const bulk = counts.map(({ _id, count }) => ({
    updateOne: {
      filter: { _id },
      update: { $set: { referralCount: count } },
    },
  }));

  const referrerIds = counts.map(({ _id }) => _id);
  if (bulk.length) await User.bulkWrite(bulk);

  const resetResult = await User.updateMany(
    { _id: { $nin: referrerIds }, referralCount: { $ne: 0 } },
    { $set: { referralCount: 0 } }
  );

  console.log(
    `Reconciled ${bulk.length} referrer count(s). Reset ${resetResult.modifiedCount || 0} stale count(s).`
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

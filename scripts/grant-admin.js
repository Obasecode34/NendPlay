require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/models/User");
const { ADMIN_PERMISSIONS } = require("../src/config/adminPermissions");

async function main() {
  const identifier = process.argv[2];
  const role = process.argv[3] || "super_admin";

  if (!identifier) {
    console.error("Usage: npm run admin:grant -- <email-or-username> [admin|super_admin]");
    process.exit(1);
  }

  if (!["admin", "super_admin"].includes(role)) {
    console.error("Role must be admin or super_admin");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const query = identifier.includes("@")
    ? { email: identifier.toLowerCase() }
    : { username: identifier };

  const user = await User.findOne(query);
  if (!user) {
    console.error(`No user found for ${identifier}`);
    process.exit(1);
  }

  user.role = role;
  user.adminPermissions = role === "super_admin" ? ADMIN_PERMISSIONS : ADMIN_PERMISSIONS;
  await user.save();

  console.log(`${identifier} is now ${role}`);
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err.message);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});

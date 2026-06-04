// src/server.js
const { HOST, PORT } = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");
const cron = require("node-cron");

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, HOST, () => {
    console.log(`\n🚀  NendPlay API running on port ${PORT}`);
    console.log(`    Environment  : ${process.env.NODE_ENV}`);
    console.log(`    Health check : http://localhost:${PORT}/health`);
    console.log(`    Auth API     : http://localhost:${PORT}/api/auth`);
    console.log(`    Referrals    : http://localhost:${PORT}/api/referrals\n`);
  });

  // Every hour — expire ads
  cron.schedule("0 * * * *", async () => {
    try {
      const adService = require("./services/ad.service");
      const result = await adService.expireOldAds();
      if (result.expired > 0) console.log(`⏰  Cron: ${result.expired} ad(s) expired`);
    } catch (err) {
      console.error("Cron (ad expiry):", err.message);
    }
  });

  // Every day at midnight — expire reward subscriptions
  cron.schedule("0 0 * * *", async () => {
    try {
      const referralService = require("./services/referral.service");
      const result = await referralService.expireRewards();
      if (result.expired > 0) console.log(`⏰  Cron: ${result.expired} reward(s) expired`);
    } catch (err) {
      console.error("Cron (reward expiry):", err.message);
    }
  });

  process.on("SIGTERM", () => {
    console.log("SIGTERM received. Shutting down gracefully...");
    server.close(() => { console.log("HTTP server closed."); process.exit(0); });
  });

  process.on("uncaughtException", (err) => { console.error("Uncaught Exception:", err); process.exit(1); });
  process.on("unhandledRejection", (reason) => { console.error("Unhandled Rejection:", reason); process.exit(1); });
};

startServer();

// src/config/db.js
// Handles MongoDB Atlas connection via Mongoose.
// Connects once at startup. Logs clearly on success or failure.

const mongoose = require("mongoose");
const { MONGODB_URI, NODE_ENV } = require("./env");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI, {
  serverSelectionTimeoutMS: 30000,
  socketTimeoutMS: 45000,
  family: 4,
  ssl: true,
  tls: true,
});
    // const conn = await mongoose.connect(MONGODB_URI, {
    //   // These options silence deprecation warnings in Mongoose 8+
    // });

    console.log(`✅  MongoDB connected: ${conn.connection.host}`);

    // Log queries in development — useful for debugging slow queries
    if (NODE_ENV === "development") {
      mongoose.set("debug", false); // flip to true to see every query
    }
  } catch (error) {
    console.error(`❌  MongoDB connection failed: ${error.message}`);
    process.exit(1); // Kill the server — no DB means nothing works
  }
};

// Graceful shutdown: close DB connection when process is terminated
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  console.log("MongoDB connection closed (app terminated)");
  process.exit(0);
});

module.exports = connectDB;

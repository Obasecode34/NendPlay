// src/app.js
const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");

const { NODE_ENV, ALLOWED_ORIGINS } = require("./config/env");
const { generalLimiter } = require("./middleware/rateLimit.middleware");
const { errorMiddleware, notFoundMiddleware } = require("./middleware/error.middleware");

const authRoutes         = require("./routes/auth.routes");
const mediaRoutes        = require("./routes/media.routes");
const novelRoutes        = require("./routes/novel.routes");
const subscriptionRoutes = require("./routes/subscription.routes");
const adRoutes           = require("./routes/ad.routes");
const downloadRoutes     = require("./routes/download.routes");
const referralRoutes     = require("./routes/referral.routes");
const newsRoutes         = require("./routes/news.routes");
const notificationRoutes = require("./routes/notification.routes");
const rewardRoutes       = require("./routes/reward.routes");
const adminRoutes        = require("./routes/admin.routes");

const app = express();

app.set("trust proxy", 1);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin} is not an allowed origin`));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(morgan(NODE_ENV === "development" ? "dev" : "combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use("/api", generalLimiter);

app.get("/health", (req, res) => {
  res.status(200).json({
    success: true,
    message: "NendPlay API is running",
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/auth",      authRoutes);
app.use("/api/media",     mediaRoutes);
app.use("/api/novels",    novelRoutes);
app.use("/api/subs",      subscriptionRoutes);
app.use("/api/ads",       adRoutes);
app.use("/api/downloads", downloadRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/rewards",   rewardRoutes);
app.use("/api/admin",     adminRoutes);
app.use("/api/news",      newsRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

module.exports = app;

// src/models/User.js
//
// The User schema is the most important model in this system.
// It supports TWO sign-up paths:
//
//   Path A — Email only:      { email, authMethod: "email" }
//   Path B — Credentials:     { username, password, authMethod: "credentials" }
//
// Both paths produce a valid User. Fields not relevant to a path are optional.
// A custom pre-save validator enforces the rule: you must have one or the other.

const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema(
  {
    // ── Identity ──────────────────────────────────────────────────────────
    authMethod: {
      type: String,
      enum: ["email", "credentials", "google"],
      required: [true, "Auth method is required"],
    },

    googleId: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },

    email: {
      type: String,
      unique: true,
      sparse: true, // sparse = allows multiple documents with no email (null is not indexed)
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Invalid email format"],
    },

    username: {
      type: String,
      unique: true,
      sparse: true, // same reason as email — credentials users have it, email users don't
      trim: true,
      minlength: [3, "Username must be at least 3 characters"],
      maxlength: [30, "Username cannot exceed 30 characters"],
      match: [/^[a-zA-Z0-9_]+$/, "Username can only contain letters, numbers, and underscores"],
    },

    password: {
      type: String,
      select: false, // NEVER returned in queries unless explicitly asked (.select("+password"))
      minlength: [6, "Password must be at least 6 characters"],
    },

    // ── Profile ───────────────────────────────────────────────────────────
    profileName: {
      type: String,
      trim: true,
      maxlength: [50, "Profile name cannot exceed 50 characters"],
      default: "",
    },

    profilePic: {
      type: String, // URL (Cloudinary in Phase 2+)
      default: "",
    },

    profilePicCloudinaryId: {
      type: String,
      select: false,
      default: null,
    },

    // ── Subscription ──────────────────────────────────────────────────────
    subscriptionPlan: {
      type: String,
      enum: ["none", "mobile", "basic", "standard", "premium"],
      default: "none",
    },

    subscriptionExpiry: {
      type: Date,
      default: null,
    },

    isSubscriptionActive: {
      type: Boolean,
      default: false,
    },

    // ── Referral & Rewards ────────────────────────────────────────────────
    referralCode: {
      type: String,
      unique: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    referralCount: {
      type: Number,
      default: 0,
    },

    savedMedia: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
      },
    ],

    savedMediaCount: {
      type: Number,
      default: 0,
    },

    subscribedCreators: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    subscriberCount: {
      type: Number,
      default: 0,
    },

    rewardActive: {
      type: Boolean,
      default: false,
    },

    rewardExpiry: {
      type: Date,
      default: null,
    },

    rewardCoins: {
      type: Number,
      default: 0,
      min: 0,
    },

    adFreeUntil: {
      type: Date,
      default: null,
    },

    // ── Active Sessions (for concurrent stream limiting in Phase 4) ────────
    // Each entry: { deviceId, lastActive, streamActive }
    activeSessions: {
      type: [
        {
          deviceId: String,
          lastActive: { type: Date, default: Date.now },
          streamActive: { type: Boolean, default: false },
        },
      ],
      default: [],
    },

    // ── Account Status ────────────────────────────────────────────────────
    isActive: {
      type: Boolean,
      default: true,
    },

    isVerified: {
      type: Boolean,
      default: false, // email verification — Phase 1 sets false, can add verify flow later
    },

    passwordResetTokenHash: {
      type: String,
      select: false,
      default: null,
    },

    passwordResetExpires: {
      type: Date,
      select: false,
      default: null,
    },

    role: {
      type: String,
      enum: ["user", "admin", "super_admin"],
      default: "user",
      index: true,
    },

    adminPermissions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt automatically
  }
);

// ── Pre-save Validation: enforce dual-auth logic ───────────────────────────
// This runs BEFORE every .save() call.
// Like a guard at the door: you need either an email keycard OR a username+password keycard.
userSchema.pre("validate", function (next) {
  if (this.authMethod === "email") {
    if (!this.email) {
      return next(new Error("Email is required for account creation"));
    }
    if (!this.username) {
      return next(new Error("Username is required for account creation"));
    }
    if (!this.password && this.isNew) {
      return next(new Error("Password is required for account creation"));
    }
  } else if (this.authMethod === "credentials") {
    if (!this.username) {
      return next(new Error("Username is required for credentials-based sign-up"));
    }
    if (!this.password && this.isNew) {
      return next(new Error("Password is required for credentials-based sign-up"));
    }
  } else if (this.authMethod === "google") {
    if (!this.email) {
      return next(new Error("Email is required for Google sign-in"));
    }
    if (!this.googleId) {
      return next(new Error("Google account id is required"));
    }
  }
  next();
});

// ── Pre-save Hook: hash password before saving ────────────────────────────
// Only runs if password field was modified (new signup or password change).
// bcrypt is computationally expensive by design — that's the point.
// saltRounds=12 means 2^12 = 4096 iterations. Slow for attackers, fine for users.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || !this.password) return next();

  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// ── Instance Method: compare password ────────────────────────────────────
// Called during login. Returns true if password matches hash.
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// ── Instance Method: check subscription validity ──────────────────────────
userSchema.methods.hasActiveSubscription = function () {
  if (this.subscriptionPlan === "none") return false;
  if (!this.subscriptionExpiry) return false;
  return new Date() < new Date(this.subscriptionExpiry);
};

// ── Instance Method: safe public profile (no sensitive fields) ─────────────
userSchema.methods.toPublicProfile = function () {
  return {
    id: this._id,
    profileName: this.profileName,
    profilePic: this.profilePic,
    username: this.username || null,
    email: this.email || null,
    authMethod: this.authMethod,
    subscriptionPlan: this.subscriptionPlan,
    subscriptionExpiry: this.subscriptionExpiry,
    isSubscriptionActive: this.hasActiveSubscription(),
    referralCode: this.referralCode,
    referralCount: this.referralCount,
    savedMediaCount: this.savedMediaCount || 0,
    subscriberCount: this.subscriberCount || 0,
    role: this.role || "user",
    adminPermissions: this.adminPermissions || [],
    rewardActive: this.rewardActive,
    rewardCoins: this.rewardCoins || 0,
    adFreeUntil: this.adFreeUntil,
    isAdFreeActive: Boolean(this.adFreeUntil && new Date() < new Date(this.adFreeUntil)),
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model("User", userSchema);

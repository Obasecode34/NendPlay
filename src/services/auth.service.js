// src/services/auth.service.js
// Business logic for authentication.
// Updated in Phase 7 to properly record referrals via referral.service.js

const User = require("../models/User");
const tokenService = require("./token.service");
const emailService = require("./email.service");
const cloudinaryService = require("./cloudinary.service");
const generateReferralCode = require("../utils/generateReferralCode");
const crypto = require("crypto");

const RESET_TOKEN_TTL_MINUTES = 15;

function hashResetToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

class AuthService {
  // ── Register ───────────────────────────────────────────────────────────
  async register({ email, username, password, profileName, referralCode }) {
    // 1. Check for duplicates
    const normalizedEmail = String(email || "").toLowerCase().trim();
    const normalizedUsername = String(username || "").trim();
    const normalizedProfileName = String(profileName || "").trim();

    if (!normalizedEmail) throw { status: 400, message: "Email address is required" };
    if (!normalizedUsername) throw { status: 400, message: "Username is required" };
    if (!normalizedProfileName) throw { status: 400, message: "Display name is required" };
    if (!password) throw { status: 400, message: "Password is required for account creation" };

    const emailExists = await User.findOne({ email: normalizedEmail });
    if (emailExists) throw { status: 409, message: "An account with this email already exists" };

    const usernameExists = await User.findOne({ username: normalizedUsername });
    if (usernameExists) throw { status: 409, message: "This username is already taken" };

    // 2. Resolve referrer
    let referrerId = null;
    let validReferralCode = null;

    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrerId = referrer._id;
        validReferralCode = referralCode;
      }
    }

    // 3. Generate unique referral code for new user
    let newReferralCode;
    let codeIsUnique = false;
    while (!codeIsUnique) {
      newReferralCode = generateReferralCode();
      const codeExists = await User.findOne({ referralCode: newReferralCode });
      if (!codeExists) codeIsUnique = true;
    }

    // 4. Build and save user
    const userData = {
      authMethod: "email",
      referralCode: newReferralCode,
      referredBy: referrerId,
      email: normalizedEmail,
      username: normalizedUsername,
      password,
      profileName: normalizedProfileName,
    };

    const user = await User.create(userData);

    // 5. Record referral in Referral collection + check reward
    // Done AFTER user is created so referredUserId exists
    if (referrerId && validReferralCode) {
      // Lazy require to avoid circular dependency
      const referralService = require("./referral.service");
      await referralService.recordReferral(
        referrerId,
        user._id,
        validReferralCode
      );
    }

    if (user.email) {
      emailService
        .sendWelcomeEmail({
          to: user.email,
          name: user.profileName || user.username,
        })
        .catch((error) => {
          console.error("Welcome email failed:", error.message);
        });
    }

    return user;
  }

  async deleteIncompleteRegistration(userId) {
    return User.deleteOne({ _id: userId });
  }

  // ── Login ──────────────────────────────────────────────────────────────
  async verifyGoogleIdToken(idToken) {
    const response = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    );
    if (!response.ok) {
      throw { status: 401, message: "Google sign in failed. Please try again." };
    }

    const profile = await response.json();
    const allowedAudiences = [
      process.env.GOOGLE_WEB_CLIENT_ID,
      process.env.GOOGLE_ANDROID_CLIENT_ID,
      process.env.GOOGLE_IOS_CLIENT_ID,
    ].filter(Boolean);

    if (allowedAudiences.length > 0 && !allowedAudiences.includes(profile.aud)) {
      throw { status: 401, message: "Google client is not allowed for this project" };
    }
    if (!profile.email || profile.email_verified !== "true") {
      throw { status: 401, message: "Google account email is not verified" };
    }

    return {
      googleId: profile.sub,
      email: profile.email.toLowerCase(),
      profileName: profile.name || profile.given_name || profile.email.split("@")[0],
      profilePic: profile.picture || "",
    };
  }

  async generateUniqueUsername(baseValue) {
    const base = String(baseValue || "nendplay_user")
      .split("@")[0]
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 20) || "nendplay_user";

    let username = base;
    let index = 0;
    while (await User.findOne({ username })) {
      index += 1;
      username = `${base}${index}`.slice(0, 30);
    }
    return username;
  }

  async loginWithGoogle({ idToken, referralCode }) {
    const googleProfile = await this.verifyGoogleIdToken(idToken);

    let user = await User.findOne({
      $or: [{ googleId: googleProfile.googleId }, { email: googleProfile.email }],
    }).select("+password");

    if (user) {
      if (!user.isActive) {
        throw {
          status: 403,
          message: "Your account has been deactivated. Contact support.",
        };
      }
      if (!user.googleId) user.googleId = googleProfile.googleId;
      if (!user.username) user.username = await this.generateUniqueUsername(googleProfile.email);
      if (!user.profilePic && googleProfile.profilePic) user.profilePic = googleProfile.profilePic;
      if (!user.profileName && googleProfile.profileName) user.profileName = googleProfile.profileName;
      user.authMethod = user.password ? user.authMethod : "google";
      await user.save();
      return user;
    }

    let referrerId = null;
    let validReferralCode = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrerId = referrer._id;
        validReferralCode = referralCode;
      }
    }

    let newReferralCode;
    let codeIsUnique = false;
    while (!codeIsUnique) {
      newReferralCode = generateReferralCode();
      const codeExists = await User.findOne({ referralCode: newReferralCode });
      if (!codeExists) codeIsUnique = true;
    }

    const username = await this.generateUniqueUsername(googleProfile.email);
    user = await User.create({
      authMethod: "google",
      googleId: googleProfile.googleId,
      email: googleProfile.email,
      username,
      profileName: googleProfile.profileName,
      profilePic: googleProfile.profilePic,
      referralCode: newReferralCode,
      referredBy: referrerId,
      isVerified: true,
    });

    if (referrerId && validReferralCode) {
      const referralService = require("./referral.service");
      await referralService.recordReferral(referrerId, user._id, validReferralCode);
    }

    emailService
      .sendWelcomeEmail({ to: user.email, name: user.profileName || user.username })
      .catch((error) => {
        console.error("Welcome email failed:", error.message);
      });

    return user;
  }

  async login({ email, identifier, password }) {
    const normalizedIdentifier = String(email || identifier || "").trim();
    const normalizedLookup = normalizedIdentifier.toLowerCase();
    if (!normalizedIdentifier) {
      throw { status: 400, message: "Email address or username is required" };
    }

    const user = await User.findOne(
      normalizedLookup.includes("@")
        ? { email: normalizedLookup }
        : { username: normalizedIdentifier }
    ).select("+password");
    if (!user) throw { status: 401, message: "Invalid email/username or password" };
    if (user.authMethod === "google" && !user.password) {
      throw {
        status: 401,
        message: "This account uses Gmail sign in. Continue with Google.",
      };
    }
    if (!user.password) {
      throw {
        status: 401,
        message: "Please reset your password to continue signing in.",
      };
    }

    if (!user.isActive) {
      throw {
        status: 403,
        message: "Your account has been deactivated. Contact support.",
      };
    }

    if (!password || !user.password) {
      throw { status: 401, message: "Invalid credentials" };
    }

    const passwordMatch = await user.comparePassword(password);
    if (!passwordMatch) {
      throw { status: 401, message: "Invalid credentials" };
    }

    return user;
  }

  // ── Refresh Token Rotation ─────────────────────────────────────────────
  async refreshTokens(oldRefreshToken, deviceInfo) {
    const { valid, decoded, error } =
      tokenService.verifyRefreshToken(oldRefreshToken);
    if (!valid) throw { status: 401, message: `Token invalid: ${error}` };

    const storedToken = await tokenService.findRefreshToken(oldRefreshToken);
    if (!storedToken)
      throw {
        status: 401,
        message: "Token has been revoked or doesn't exist",
      };

    await tokenService.deleteRefreshToken(oldRefreshToken);

    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive)
      throw { status: 401, message: "User not found or deactivated" };

    const newAccessToken = tokenService.generateAccessToken(user._id);
    const newRefreshToken = tokenService.generateRefreshToken(user._id);

    await tokenService.storeRefreshToken(
      user._id,
      newRefreshToken,
      deviceInfo
    );

    return {
      user,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // ── Get user by ID ─────────────────────────────────────────────────────
  async getUserById(userId) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };
    return user;
  }

  // ── Update profile ─────────────────────────────────────────────────────
  async updateProfile(userId, { profileName, profilePic, email, username }) {
    const user = await User.findById(userId);
    if (!user) throw { status: 404, message: "User not found" };

    if (profileName !== undefined) user.profileName = profileName;
    if (profilePic !== undefined) user.profilePic = profilePic;

    if (email !== undefined) {
      const normalizedEmail = email ? email.toLowerCase().trim() : "";
      if (!normalizedEmail) throw { status: 400, message: "Email cannot be empty" };

      const exists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: userId },
      });
      if (exists) throw { status: 409, message: "Email already in use" };
      user.email = normalizedEmail;
    }

    if (username !== undefined) {
      const normalizedUsername = username ? username.trim() : "";
      if (!normalizedUsername) throw { status: 400, message: "Username cannot be empty" };

      const exists = await User.findOne({
        username: normalizedUsername,
        _id: { $ne: userId },
      });
      if (exists) throw { status: 409, message: "Username already in use" };
      user.username = normalizedUsername;
    }

    if (user.email && user.username && user.password && user.authMethod !== "google") {
      user.authMethod = "email";
    }

    await user.save();
    return user;
  }

  // ── Change password ────────────────────────────────────────────────────
  async updateProfilePicture(userId, file) {
    if (!file?.buffer) {
      throw { status: 400, message: "Profile picture is required" };
    }

    const user = await User.findById(userId).select("+profilePicCloudinaryId");
    if (!user) throw { status: 404, message: "User not found" };

    const previousCloudinaryId = user.profilePicCloudinaryId;
    const uploadResult = await cloudinaryService.uploadProfileImage(file.buffer, {
      folder: "nendplay/profiles",
    });

    user.profilePic = uploadResult.secure_url;
    user.profilePicCloudinaryId = uploadResult.public_id;
    await user.save();

    if (previousCloudinaryId) {
      await cloudinaryService.deleteFile(previousCloudinaryId, "image");
    }

    return user;
  }

  async changePassword(userId, { currentPassword, newPassword }) {
    const user = await User.findById(userId).select("+password");
    if (!user) throw { status: 404, message: "User not found" };

    if (user.password) {
      const match = await user.comparePassword(currentPassword);
      if (!match) throw { status: 401, message: "Current password is incorrect" };
    } else if (!newPassword) {
      throw { status: 400, message: "New password is required" };
    }

    user.password = newPassword;
    if (user.email && user.username) user.authMethod = "email";
    await user.save();

    return user;
  }

  async updateEmail(userId, email) {
    return this.updateProfile(userId, { email });
  }

  async updateUsername(userId, username) {
    return this.updateProfile(userId, { username });
  }

  async requestPasswordReset({ identifier }) {
    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      email: normalizedIdentifier,
    }).select("+passwordResetTokenHash +passwordResetExpires");

    const response = {
      message: "If this account exists, password reset instructions have been prepared.",
    };

    if (!user || !user.isActive) {
      return response;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    user.passwordResetTokenHash = hashResetToken(resetToken);
    user.passwordResetExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await user.save();
    await emailService.sendPasswordReset({ to: user.email, token: resetToken });

    // TODO: connect SMTP/transactional email before production launch.
    // For development builds, return/log the token so the flow can be tested end-to-end.
    if (process.env.NODE_ENV !== "production" || process.env.PASSWORD_RESET_RETURN_TOKEN === "true") {
      response.resetToken = resetToken;
      response.devOnly = true;
      console.log(`[password-reset] ${normalizedIdentifier}: ${resetToken}`);
    }

    return response;
  }

  async resetPassword({ token, newPassword }) {
    const user = await User.findOne({
      passwordResetTokenHash: hashResetToken(token),
      passwordResetExpires: { $gt: new Date() },
    }).select("+password +passwordResetTokenHash +passwordResetExpires");

    if (!user) {
      throw { status: 400, message: "Password reset link is invalid or has expired" };
    }

    user.password = newPassword;
    user.passwordResetTokenHash = null;
    user.passwordResetExpires = null;
    await user.save();
    await tokenService.deleteAllUserTokens(user._id);

    return user;
  }
}

module.exports = new AuthService();

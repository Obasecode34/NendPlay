// src/controllers/auth.controller.js
//
// Controllers are thin. They:
//   1. Extract data from req
//   2. Call the service
//   3. Send the response
//
// No business logic here. That's the service's job.
// Think of controllers as receptionists — they route, they don't decide.

const authService = require("../services/auth.service");
const tokenService = require("../services/token.service");
const ApiResponse = require("../utils/apiResponse");

class AuthController {
  getDuplicateRegistrationMessage(err) {
    const key = Object.keys(err.keyPattern || err.keyValue || {})[0];
    if (key === "email") return "An account with this email already exists";
    if (key === "username") return "This username is already taken";
    if (key === "googleId") return "This Gmail account is already connected to another user";
    return "An account with these details already exists";
  }

  // POST /api/auth/register
  async register(req, res) {
    let createdUser = null;
    try {
      const {
        email,
        username,
        password,
        profileName,
        referralCode,
      } = req.body;

      const user = await authService.register({
        email,
        username,
        password,
        profileName,
        referralCode,
      });
      createdUser = user;

      // Generate tokens immediately after registration (auto-login)
      const accessToken = tokenService.generateAccessToken(user._id);
      const refreshToken = tokenService.generateRefreshToken(user._id);

      const deviceInfo = req.headers["user-agent"] || "unknown";
      await tokenService.storeRefreshToken(user._id, refreshToken, deviceInfo);
      tokenService.setRefreshTokenCookie(res, refreshToken);

      return ApiResponse.created(res, {
        message: "Account created successfully",
        data: {
          user: user.toPublicProfile(),
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      if (err.code === 11000) {
        return ApiResponse.error(res, {
          statusCode: 409,
          message: this.getDuplicateRegistrationMessage(err),
        });
      }
      // Mongoose validation errors
      if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map((e) => e.message);
        return ApiResponse.badRequest(res, "Validation failed", messages);
      }
      if (err.message && /required|invalid|password|username|email/i.test(err.message)) {
        return ApiResponse.badRequest(res, err.message);
      }
      if (createdUser?._id) {
        await authService.deleteIncompleteRegistration(createdUser._id).catch((cleanupError) => {
          console.error("Incomplete registration cleanup failed:", cleanupError);
        });
      }
      console.error("Register error:", err);
      return ApiResponse.error(res, { message: "Registration failed. Please try again." });
    }
  }

  // POST /api/auth/login
  async login(req, res) {
    try {
      const { email, identifier, password } = req.body;

      const user = await authService.login({ email, identifier, password });

      const accessToken = tokenService.generateAccessToken(user._id);
      const refreshToken = tokenService.generateRefreshToken(user._id);

      const deviceInfo = req.headers["user-agent"] || "unknown";
      await tokenService.storeRefreshToken(user._id, refreshToken, deviceInfo);
      tokenService.setRefreshTokenCookie(res, refreshToken);

      return ApiResponse.success(res, {
        message: "Login successful",
        data: {
          user: user.toPublicProfile(),
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Login error:", err);
      return ApiResponse.error(res, { message: "Login failed. Please try again." });
    }
  }

  // POST /api/auth/google
  async googleAuth(req, res) {
    try {
      if (process.env.GOOGLE_AUTH_ENABLED !== "true") {
        return ApiResponse.badRequest(res, "Gmail sign in is temporarily disabled");
      }

      const { idToken, referralCode } = req.body;
      const user = await authService.loginWithGoogle({ idToken, referralCode });

      const accessToken = tokenService.generateAccessToken(user._id);
      const refreshToken = tokenService.generateRefreshToken(user._id);

      const deviceInfo = req.headers["user-agent"] || "unknown";
      await tokenService.storeRefreshToken(user._id, refreshToken, deviceInfo);
      tokenService.setRefreshTokenCookie(res, refreshToken);

      return ApiResponse.success(res, {
        message: "Google sign in successful",
        data: {
          user: user.toPublicProfile(),
          accessToken,
          refreshToken,
        },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Google auth error:", err);
      return ApiResponse.error(res, { message: "Google sign in failed. Please try again." });
    }
  }

  // POST /api/auth/forgot-password
  async forgotPassword(req, res) {
    try {
      const { identifier } = req.body;
      const result = await authService.requestPasswordReset({ identifier });

      return ApiResponse.success(res, {
        message: result.message,
        data: {
          resetToken: result.resetToken,
          devOnly: result.devOnly || false,
        },
      });
    } catch (err) {
      console.error("Forgot password error:", err);
      return ApiResponse.error(res, { message: "Password recovery failed. Please try again." });
    }
  }

  // POST /api/auth/reset-password
  async resetPassword(req, res) {
    try {
      const { token, newPassword } = req.body;
      await authService.resetPassword({ token, newPassword });

      return ApiResponse.success(res, {
        message: "Password reset successfully. Please sign in with your new password.",
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Reset password error:", err);
      return ApiResponse.error(res, { message: "Password reset failed. Please try again." });
    }
  }

  // POST /api/auth/logout
  async logout(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (refreshToken) {
        await tokenService.deleteRefreshToken(refreshToken);
      }

      tokenService.clearRefreshTokenCookie(res);

      return ApiResponse.success(res, { message: "Logged out successfully" });
    } catch (err) {
      console.error("Logout error:", err);
      // Even if something goes wrong, clear the cookie
      tokenService.clearRefreshTokenCookie(res);
      return ApiResponse.success(res, { message: "Logged out" });
    }
  }

  // POST /api/auth/refresh-token
  async refreshToken(req, res) {
    try {
      const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

      if (!refreshToken) {
        return ApiResponse.unauthorized(res, "No refresh token provided");
      }

      const deviceInfo = req.headers["user-agent"] || "unknown";
      const { user, accessToken, refreshToken: newRefreshToken } =
        await authService.refreshTokens(refreshToken, deviceInfo);

      // Set the new refresh token as a cookie (rotation complete)
      tokenService.setRefreshTokenCookie(res, newRefreshToken);

      return ApiResponse.success(res, {
        message: "Token refreshed",
        data: {
          user: user.toPublicProfile(),
          accessToken,
          refreshToken: newRefreshToken,
        },
      });
    } catch (err) {
      if (err.status) {
        tokenService.clearRefreshTokenCookie(res);
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res, { message: "Token refresh failed" });
    }
  }

  // GET /api/auth/me — get current user (requires auth)
  async getMe(req, res) {
    try {
      // req.user is set by the auth middleware
      const user = await authService.getUserById(req.user.userId);
      return ApiResponse.success(res, {
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/auth/update-profile
  async updateProfile(req, res) {
    try {
      const { profileName, profilePic, email, username } = req.body;
      const user = await authService.updateProfile(req.user.userId, {
        profileName,
        profilePic,
        email,
        username,
      });
      return ApiResponse.success(res, {
        message: "Profile updated",
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/auth/profile-picture
  async updateProfilePicture(req, res) {
    try {
      const user = await authService.updateProfilePicture(req.user.userId, req.file);
      return ApiResponse.success(res, {
        message: "Profile picture updated",
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      console.error("Profile picture update error:", err);
      return ApiResponse.error(res, { message: "Profile picture update failed. Please try again." });
    }
  }

  // PATCH /api/auth/change-password
  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;
      const user = await authService.changePassword(req.user.userId, {
        currentPassword,
        newPassword,
      });

      // Invalidate all other refresh tokens after password change — security best practice
      await tokenService.deleteAllUserTokens(req.user.userId);
      tokenService.clearRefreshTokenCookie(res);

      return ApiResponse.success(res, {
        message: "Password updated successfully. Please log in again.",
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/auth/update-email
  async updateEmail(req, res) {
    try {
      const { email } = req.body;
      if (!email) return ApiResponse.badRequest(res, "Email is required");

      const user = await authService.updateEmail(req.user.userId, email);

      return ApiResponse.success(res, {
        message: "Email updated successfully",
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }

  // PATCH /api/auth/update-username
  async updateUsername(req, res) {
    try {
      const { username } = req.body;
      if (!username) return ApiResponse.badRequest(res, "Username is required");

      const user = await authService.updateUsername(req.user.userId, username);

      return ApiResponse.success(res, {
        message: "Username updated successfully",
        data: { user: user.toPublicProfile() },
      });
    } catch (err) {
      if (err.status) {
        return ApiResponse.error(res, { statusCode: err.status, message: err.message });
      }
      return ApiResponse.error(res);
    }
  }
}

module.exports = new AuthController();

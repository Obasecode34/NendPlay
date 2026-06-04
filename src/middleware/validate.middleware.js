// src/middleware/validate.middleware.js

const { body, validationResult } = require("express-validator");
const ApiResponse = require("../utils/apiResponse");

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const messages = errors.array().map((e) => e.msg);
    return ApiResponse.badRequest(res, "Validation failed", messages);
  }
  next();
};

const validateRegister = [
  body("email")
    .notEmpty().withMessage("Email address is required")
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),

  body("profileName")
    .notEmpty().withMessage("Display name is required")
    .isLength({ max: 50 }).withMessage("Display name cannot exceed 50 characters")
    .trim(),

  body("username")
    .notEmpty().withMessage("Username is required")
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, and underscores"),

  body("password")
    .notEmpty().withMessage("Password is required for account creation")
    .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

  body("confirmPassword")
    .notEmpty().withMessage("Confirm password is required")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Passwords do not match");
      }
      return true;
    }),

  body("referralCode")
    .optional({ checkFalsy: true })
    .isString().withMessage("Invalid referral code format"),

  handleValidation,
];

const validateLogin = [
  body("email")
    .optional({ checkFalsy: true })
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),

  body("identifier")
    .optional({ checkFalsy: true })
    .trim(),

  body().custom((value) => {
    if (!value.email && !value.identifier) {
      throw new Error("Email address is required");
    }
    return true;
  }),

  body("password")
    .notEmpty().withMessage("Password is required"),

  handleValidation,
];

const validateGoogleAuth = [
  body("idToken")
    .notEmpty().withMessage("Google ID token is required")
    .isString().withMessage("Google ID token must be text"),

  body("referralCode")
    .optional({ checkFalsy: true })
    .isString().withMessage("Invalid referral code format"),

  handleValidation,
];

const validateForgotPassword = [
  body("identifier")
    .notEmpty().withMessage("Email address is required")
    .trim(),

  handleValidation,
];

const validateResetPassword = [
  body("token")
    .notEmpty().withMessage("Reset token is required")
    .isString().withMessage("Reset token must be text")
    .trim(),

  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),

  handleValidation,
];

const validateUpdateProfile = [
  body("profileName")
    .optional()
    .isLength({ max: 50 }).withMessage("Profile name cannot exceed 50 characters")
    .trim(),

  body("profilePic")
    .optional()
    .isURL().withMessage("Profile picture must be a valid URL"),

  body("email")
    .optional()
    .isEmail().withMessage("Invalid email format")
    .normalizeEmail(),

  body("username")
    .optional()
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, and underscores"),

  handleValidation,
];

const validateChangePassword = [
  body("currentPassword")
    .optional({ checkFalsy: true })
    .isString().withMessage("Current password must be text"),

  body("newPassword")
    .notEmpty().withMessage("New password is required")
    .isLength({ min: 6 }).withMessage("New password must be at least 6 characters")
    .custom((value, { req }) => {
      if (value === req.body.currentPassword) {
        throw new Error("New password must be different from current password");
      }
      return true;
    }),

  handleValidation,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateGoogleAuth,
  validateForgotPassword,
  validateResetPassword,
  validateUpdateProfile,
  validateChangePassword,
};

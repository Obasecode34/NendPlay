// src/utils/generateReferralCode.js
//
// Generates a unique referral code for each user on signup.
// Format: NP- + 8 random alphanumeric chars (e.g. NP-X7K2M9PQ)
// nanoid v3 is used (CommonJS compatible).

const { nanoid } = require("nanoid");

const generateReferralCode = () => {
  // 8 chars of alphanumeric = 36^8 = ~2.8 trillion combinations
  // More than enough for NendPlay's user base
  return `NP-${nanoid(8).toUpperCase()}`;
};

module.exports = generateReferralCode;

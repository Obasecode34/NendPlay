// src/config/adPricing.js
//
// Ad pricing tiers based on type, placement, and duration.
// Advertisers pay based on these rates.
// All prices in Naira.

const AD_PRICING = {
  // Base price per day (Naira)
  baseRatePerDay: {
    banner: 500,      // ₦500/day for banner ads
    video: 1500,      // ₦1500/day for video ads
    overlay: 2000,    // ₦2000/day for live event overlay ads
  },

  // Placement multipliers
  placementMultiplier: {
    home: 2.0,        // Home tab gets most traffic — premium price
    live_event: 2.5,  // Live events — highest engagement
    media: 1.5,       // During media playback
    news: 1.4,        // News feeds and article details
    downloads: 1.0,   // Downloads screens
    profile: 1.0,     // Profile/settings screens
    subscription: 1.2,// Subscription and rewards screens
    shorts: 1.8,      // Shorts — high engagement
    novels: 1.0,      // NovelHub — standard
    all: 1.5,         // All placements — average multiplier
  },
};

// Calculate total ad price
const calculateAdPrice = (adType, placement, durationDays) => {
  const baseRate = AD_PRICING.baseRatePerDay[adType] || 500;
  const multiplier = AD_PRICING.placementMultiplier[placement] || 1.0;
  const totalNaira = Math.ceil(baseRate * multiplier * durationDays);
  return totalNaira;
};

module.exports = { AD_PRICING, calculateAdPrice };

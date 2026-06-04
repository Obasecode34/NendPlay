// src/config/plans.js
//
// NendPlay subscription plans.
// Single source of truth — imported everywhere plan data is needed.
// Prices in Naira (kobo for Paystack, Naira for Flutterwave).
//
// Paystack requires amount in KOBO (multiply Naira by 100).
// Flutterwave requires amount in NAIRA directly.

const PLANS = {
  mobile: {
    id: "mobile",
    name: "Mobile",
    monthlyPriceNaira: 2500,
    monthlyPriceKobo: 250000, // Paystack
    supportedDevices: ["mobile", "tablet"],
    maxConcurrentStreams: 1,
    maxDownloadDevices: 1,
    description: "Watch on mobile and tablet",
  },
  basic: {
    id: "basic",
    name: "Basic",
    monthlyPriceNaira: 4000,
    monthlyPriceKobo: 400000,
    supportedDevices: ["tv", "computer", "mobile", "tablet"],
    maxConcurrentStreams: 1,
    maxDownloadDevices: 1,
    description: "Watch on any device",
  },
  standard: {
    id: "standard",
    name: "Standard",
    monthlyPriceNaira: 6500,
    monthlyPriceKobo: 650000,
    supportedDevices: ["tv", "computer", "mobile", "tablet"],
    maxConcurrentStreams: 2,
    maxDownloadDevices: 2,
    description: "Watch on 2 devices at the same time",
  },
  premium: {
    id: "premium",
    name: "Premium",
    monthlyPriceNaira: 8500,
    monthlyPriceKobo: 850000,
    supportedDevices: ["tv", "computer", "mobile", "tablet"],
    maxConcurrentStreams: 4,
    maxDownloadDevices: 6,
    description: "Watch on 4 devices at the same time",
    isMostPopular: true,
  },
};

// Get plan by ID — throws if invalid
const getPlan = (planId) => {
  const plan = PLANS[planId];
  if (!plan) throw { status: 400, message: `Invalid plan: ${planId}. Choose from: mobile, basic, standard, premium` };
  return plan;
};

// Get all plans as array (for listing)
const getAllPlans = () => Object.values(PLANS);

module.exports = { PLANS, getPlan, getAllPlans };

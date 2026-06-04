const AD_FREE_REWARDS = [
  { id: "adfree_1d", label: "Ad-free for 1 day", coins: 5, kind: "ad_free", days: 1 },
  { id: "adfree_7d", label: "Ad-free for 7 days", coins: 15, kind: "ad_free", days: 7 },
  { id: "adfree_30d", label: "Ad-free for 30 days", coins: 45, kind: "ad_free", days: 30 },
];

const PLAN_REWARDS = [
  { id: "plan_mobile", label: "Mobile plan", coins: 50, kind: "plan", plan: "mobile", days: 30 },
  { id: "plan_basic", label: "Basic plan", coins: 60, kind: "plan", plan: "basic", days: 30 },
  { id: "plan_standard", label: "Standard plan", coins: 70, kind: "plan", plan: "standard", days: 30 },
  { id: "plan_premium", label: "Premium plan", coins: 80, kind: "plan", plan: "premium", days: 30 },
];

const AD_REWARD_TIERS = [...AD_FREE_REWARDS, ...PLAN_REWARDS];

const REWARD_POLICY = {
  rewardOwner: "NendPlay",
  cashValue: false,
  transferable: false,
  useScope: "NendPlay ad-free access and NendPlay subscription plans only",
  googleEndorsed: false,
};

const PAID_AD_FREE = {
  pricePerDayNaira: 99,
  minDays: 1,
  maxDays: 365,
};

function getRewardTier(rewardId) {
  return AD_REWARD_TIERS.find((tier) => tier.id === rewardId);
}

module.exports = {
  AD_FREE_REWARDS,
  PLAN_REWARDS,
  AD_REWARD_TIERS,
  REWARD_POLICY,
  PAID_AD_FREE,
  getRewardTier,
};

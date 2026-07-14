// src/config/rewardTiers.js
//
// Referral rewards are coin-based. Each successful referral grants coins
// immediately; users redeem coins from the normal rewards screen.
const REFERRAL_COIN_REWARD = 100;
const REWARD_TIERS = [];

const getEligibleTier = (referralCount) => {
  for (const tier of REWARD_TIERS) {
    if (referralCount >= tier.minReferrals) return tier;
  }
  return null;
};

const getNextTier = (referralCount) => {
  const remaining = [...REWARD_TIERS].reverse();
  for (const tier of remaining) {
    if (referralCount < tier.minReferrals) {
      return {
        ...tier,
        referralsNeeded: tier.minReferrals - referralCount,
      };
    }
  }
  return null;
};

module.exports = {
  REFERRAL_COIN_REWARD,
  REWARD_TIERS,
  getEligibleTier,
  getNextTier,
};

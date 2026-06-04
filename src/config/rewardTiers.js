// src/config/rewardTiers.js
//
// Referral reward tiers.
// Tiers are cumulative checkpoints, not recurring. Once a tier is unlocked,
// the user gets that reward once. Higher tiers can still be unlocked later.

const REWARD_TIERS = [
  {
    id: "tier_4",
    minReferrals: 20,
    plan: "premium",
    durationDays: 30,
    label: "20 referrals -> Premium for 1 month",
  },
  {
    id: "tier_3",
    minReferrals: 15,
    plan: "standard",
    durationDays: 30,
    label: "15 referrals -> Standard for 1 month",
  },
  {
    id: "tier_2",
    minReferrals: 10,
    plan: "basic",
    durationDays: 30,
    label: "10 referrals -> Basic for 1 month",
  },
  {
    id: "tier_1",
    minReferrals: 5,
    plan: "mobile",
    durationDays: 30,
    label: "5 referrals -> Mobile for 1 month",
  },
];

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

module.exports = { REWARD_TIERS, getEligibleTier, getNextTier };

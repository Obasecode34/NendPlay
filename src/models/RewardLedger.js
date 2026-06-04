const mongoose = require("mongoose");

const rewardLedgerSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["earn", "redeem"],
      required: true,
    },
    source: {
      type: String,
      default: "",
    },
    coins: {
      type: Number,
      required: true,
    },
    balanceAfter: {
      type: Number,
      required: true,
    },
    rewardId: {
      type: String,
      default: "",
    },
    metadata: {
      type: Object,
      default: {},
    },
  },
  { timestamps: true }
);

rewardLedgerSchema.index({ userId: 1, createdAt: -1 });
rewardLedgerSchema.index(
  { source: 1, "metadata.transactionId": 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: "admob_ssv",
      "metadata.transactionId": { $type: "string" },
    },
  }
);

module.exports = mongoose.model("RewardLedger", rewardLedgerSchema);

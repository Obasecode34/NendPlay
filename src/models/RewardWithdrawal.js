const mongoose = require("mongoose");

const rewardWithdrawalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    coins: {
      type: Number,
      required: true,
      min: 3000,
    },
    amountNaira: {
      type: Number,
      required: true,
      min: 1000,
    },
    status: {
      type: String,
      enum: ["pending", "approved", "paid", "rejected"],
      default: "pending",
      index: true,
    },
    bankName: {
      type: String,
      trim: true,
      default: "",
    },
    accountNumber: {
      type: String,
      trim: true,
      default: "",
    },
    accountName: {
      type: String,
      trim: true,
      default: "",
    },
    notes: {
      type: String,
      trim: true,
      default: "",
    },
    processedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

rewardWithdrawalSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("RewardWithdrawal", rewardWithdrawalSchema);

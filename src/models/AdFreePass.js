const mongoose = require("mongoose");

const adFreePassSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    days: {
      type: Number,
      required: true,
      min: 1,
      max: 365,
    },
    pricePerDayNaira: {
      type: Number,
      required: true,
      default: 33.3,
    },
    amountNaira: {
      type: Number,
      required: true,
    },
    paymentGateway: {
      type: String,
      enum: ["paystack", "flutterwave", "opay", "palmpay"],
      required: true,
    },
    transactionRef: {
      type: String,
      unique: true,
      required: true,
    },
    gatewayTransactionId: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["pending", "active", "failed"],
      default: "pending",
      index: true,
    },
    startDate: {
      type: Date,
      default: null,
    },
    expiryDate: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true }
);

adFreePassSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model("AdFreePass", adFreePassSchema);

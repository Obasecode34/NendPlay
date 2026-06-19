// src/services/payment.service.js
//
// Unified PaymentService — one class, two gateways.
// The rest of the codebase never talks to Paystack or Flutterwave directly.
// It only calls PaymentService, which routes internally.
//
// Think of it as an electrical adapter:
// Your device (the app) plugs into one socket (PaymentService).
// The adapter handles whether the wall is Paystack or Flutterwave.
// Swap gateways without touching anything else.
//
// Flow:
//   initializePayment() → returns a payment URL
//   verifyPayment()     → confirms payment was successful
//   Both return a normalized response object regardless of gateway

const axios = require("axios");
const crypto = require("crypto");
const {
  PAYSTACK_SECRET_KEY,
  FLUTTERWAVE_SECRET_KEY,
  PAYSTACK_WEBHOOK_SECRET,
  FLUTTERWAVE_WEBHOOK_SECRET,
  CLIENT_URL,
} = require("../config/env");

class PaymentService {
  // ── Initialize Payment ─────────────────────────────────────────────────
  // Returns { paymentUrl, transactionRef } regardless of gateway
  async initializePayment({ gateway, email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl, title, description }) {
    if (gateway === "paystack") {
      return this._initializePaystack({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl });
    }
    if (gateway === "flutterwave") {
      return this._initializeFlutterwave({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl, title, description });
    }
    throw { status: 400, message: "Invalid payment gateway. Choose paystack or flutterwave." };
  }

  // ── Verify Payment ─────────────────────────────────────────────────────
  // Returns { verified: bool, gatewayTransactionId, amount, email }
  async verifyPayment({ gateway, transactionRef }) {
    if (gateway === "paystack") {
      return this._verifyPaystack(transactionRef);
    }
    if (gateway === "flutterwave") {
      return this._verifyFlutterwave(transactionRef);
    }
    throw { status: 400, message: "Invalid payment gateway." };
  }

  // ── Paystack: Initialize ───────────────────────────────────────────────
  buildCallbackUrl({ callbackUrl, callbackPath = "/subscription/verify", gateway, transactionRef }) {
    const baseUrl = callbackUrl || `${CLIENT_URL}${callbackPath}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}gateway=${encodeURIComponent(gateway)}&ref=${encodeURIComponent(transactionRef)}`;
  }

  async _initializePaystack({ email, amountNaira, planId, userId, transactionRef, callbackPath = "/subscription/verify", callbackUrl }) {
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: amountNaira * 100, // Paystack uses kobo
          reference: transactionRef,
          callback_url: this.buildCallbackUrl({ callbackUrl, callbackPath, gateway: "paystack", transactionRef }),
          metadata: {
            planId,
            userId: userId.toString(),
            gateway: "paystack",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        paymentUrl: response.data.data.authorization_url,
        transactionRef,
        gateway: "paystack",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      throw { status: 502, message: `Paystack initialization failed: ${message}` };
    }
  }

  // ── Paystack: Verify ───────────────────────────────────────────────────
  async _verifyPaystack(transactionRef) {
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${transactionRef}`,
        {
          headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
        }
      );

       console.log("Paystack verify response:", JSON.stringify(response.data, null, 2));

      const data = response.data.data;
      const verified = data.status === "success";

      return {
        verified,
        gatewayTransactionId: data.id?.toString(),
        amount: data.amount / 100, // convert kobo back to naira
        email: data.customer?.email,
        gateway: "paystack",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      throw { status: 502, message: `Paystack verification failed: ${message}` };
    }
  }

  // ── Flutterwave: Initialize ────────────────────────────────────────────
  async _initializeFlutterwave({
    email,
    amountNaira,
    planId,
    userId,
    transactionRef,
    callbackPath = "/subscription/verify",
    callbackUrl,
    title = "NendPlay Subscription",
    description = `NendPlay ${planId} plan`,
  }) {
    try {
      const response = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: transactionRef,
          amount: amountNaira, // Flutterwave uses Naira directly
          currency: "NGN",
          redirect_url: this.buildCallbackUrl({ callbackUrl, callbackPath, gateway: "flutterwave", transactionRef }),
          customer: { email },
          customizations: {
            title,
            description,
            logo: `${CLIENT_URL}/logo.png`,
          },
          meta: {
            planId,
            userId: userId.toString(),
            gateway: "flutterwave",
          },
        },
        {
          headers: {
            Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        }
      );

      return {
        paymentUrl: response.data.data.link,
        transactionRef,
        gateway: "flutterwave",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      throw { status: 502, message: `Flutterwave initialization failed: ${message}` };
    }
  }

  // ── Flutterwave: Verify ────────────────────────────────────────────────
  async _verifyFlutterwave(transactionRef) {
    try {
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${transactionRef}`,
        {
          headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` },
        }
      );

      const data = response.data.data;
      const verified = data.status === "successful";

      return {
        verified,
        gatewayTransactionId: data.id?.toString(),
        amount: data.amount,
        email: data.customer?.email,
        gateway: "flutterwave",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      throw { status: 502, message: `Flutterwave verification failed: ${message}` };
    }
  }

  // ── Verify Paystack Webhook Signature ─────────────────────────────────
  // Paystack signs webhooks with HMAC-SHA512.
  // We verify the signature to confirm the request is genuinely from Paystack.
  verifyPaystackWebhook(rawBody, signature) {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return hash === signature;
  }

  // ── Verify Flutterwave Webhook Signature ──────────────────────────────
  verifyFlutterwaveWebhook(signature) {
    return signature === FLUTTERWAVE_WEBHOOK_SECRET;
  }
}

module.exports = new PaymentService();

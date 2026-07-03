// src/services/payment.service.js
//
// Unified payment adapter for all supported gateways.
// The rest of the app calls this service and receives the same response shape
// whether the user pays through Paystack, Flutterwave, OPay, or PalmPay.

const axios = require("axios");
const crypto = require("crypto");
const {
  PAYSTACK_SECRET_KEY,
  FLUTTERWAVE_SECRET_KEY,
  PAYSTACK_WEBHOOK_SECRET,
  FLUTTERWAVE_WEBHOOK_SECRET,
  OPAY_MERCHANT_ID,
  OPAY_PUBLIC_KEY,
  OPAY_SECRET_KEY,
  OPAY_INITIALIZE_URL,
  OPAY_VERIFY_URL,
  PALMPAY_APP_ID,
  PALMPAY_MERCHANT_ID,
  PALMPAY_PUBLIC_KEY,
  PALMPAY_SECRET_KEY,
  PALMPAY_INITIALIZE_URL,
  PALMPAY_VERIFY_URL,
  CLIENT_URL,
} = require("../config/env");

const SUPPORTED_PAYMENT_GATEWAYS = ["paystack", "flutterwave", "opay", "palmpay"];
const SUCCESS_STATUSES = new Set(["success", "successful", "succeeded", "paid", "completed", "complete"]);

class PaymentService {
  getSupportedGateways() {
    return SUPPORTED_PAYMENT_GATEWAYS;
  }

  isSupportedGateway(gateway) {
    return SUPPORTED_PAYMENT_GATEWAYS.includes(gateway);
  }

  async initializePayment({
    gateway,
    email,
    amountNaira,
    planId,
    userId,
    transactionRef,
    callbackPath,
    callbackUrl,
    title,
    description,
  }) {
    if (gateway === "paystack") {
      return this._initializePaystack({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl });
    }
    if (gateway === "flutterwave") {
      return this._initializeFlutterwave({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl, title, description });
    }
    if (gateway === "opay") {
      return this._initializeOpay({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl, title, description });
    }
    if (gateway === "palmpay") {
      return this._initializePalmPay({ email, amountNaira, planId, userId, transactionRef, callbackPath, callbackUrl, title, description });
    }
    throw { status: 400, message: `Invalid payment gateway. Choose ${SUPPORTED_PAYMENT_GATEWAYS.join(", ")}.` };
  }

  async verifyPayment({ gateway, transactionRef }) {
    if (gateway === "paystack") return this._verifyPaystack(transactionRef);
    if (gateway === "flutterwave") return this._verifyFlutterwave(transactionRef);
    if (gateway === "opay") return this._verifyOpay(transactionRef);
    if (gateway === "palmpay") return this._verifyPalmPay(transactionRef);
    throw { status: 400, message: `Invalid payment gateway. Choose ${SUPPORTED_PAYMENT_GATEWAYS.join(", ")}.` };
  }

  buildCallbackUrl({ callbackUrl, callbackPath = "/subscription/verify", gateway, transactionRef }) {
    const baseUrl = callbackUrl || `${CLIENT_URL}${callbackPath}`;
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}gateway=${encodeURIComponent(gateway)}&ref=${encodeURIComponent(transactionRef)}`;
  }

  amountKobo(amountNaira) {
    return Math.round(Number(amountNaira || 0) * 100);
  }

  normalizeAmountNaira(value) {
    if (value == null) return undefined;
    if (typeof value === "object") {
      const nested = value.total ?? value.amount ?? value.value;
      return this.normalizeAmountNaira(nested);
    }
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return undefined;
    return numeric > 1000 ? numeric / 100 : numeric;
  }

  extractPaymentUrl(payload) {
    const data = payload?.data || payload?.result || payload;
    return (
      data?.authorization_url ||
      data?.link ||
      data?.cashierUrl ||
      data?.checkoutUrl ||
      data?.paymentUrl ||
      data?.payUrl ||
      data?.url ||
      data?.redirectUrl ||
      data?.redirect_url
    );
  }

  extractStatus(payload) {
    const data = payload?.data || payload?.result || payload;
    return String(
      data?.status ||
      data?.orderStatus ||
      data?.paymentStatus ||
      data?.transactionStatus ||
      payload?.status ||
      ""
    ).toLowerCase();
  }

  extractGatewayTransactionId(payload) {
    const data = payload?.data || payload?.result || payload;
    return (
      data?.id ||
      data?.transactionId ||
      data?.transaction_id ||
      data?.orderId ||
      data?.orderNo ||
      data?.reference ||
      data?.tx_ref
    )?.toString();
  }

  extractEmail(payload) {
    const data = payload?.data || payload?.result || payload;
    return data?.customer?.email || data?.customerEmail || data?.email || data?.userInfo?.userEmail;
  }

  requireConfig(gateway, values) {
    const missing = Object.entries(values)
      .filter(([, value]) => !value)
      .map(([key]) => key);
    if (missing.length) {
      throw {
        status: 500,
        message: `${gateway} is not configured. Missing: ${missing.join(", ")}`,
      };
    }
  }

  async _initializePaystack({ email, amountNaira, planId, userId, transactionRef, callbackPath = "/subscription/verify", callbackUrl }) {
    this.requireConfig("Paystack", { PAYSTACK_SECRET_KEY });
    try {
      const response = await axios.post(
        "https://api.paystack.co/transaction/initialize",
        {
          email,
          amount: this.amountKobo(amountNaira),
          reference: transactionRef,
          callback_url: this.buildCallbackUrl({ callbackUrl, callbackPath, gateway: "paystack", transactionRef }),
          metadata: {
            planId,
            userId: userId?.toString(),
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

  async _verifyPaystack(transactionRef) {
    this.requireConfig("Paystack", { PAYSTACK_SECRET_KEY });
    try {
      const response = await axios.get(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(transactionRef)}`,
        { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } }
      );

      const data = response.data.data;
      return {
        verified: data.status === "success",
        gatewayTransactionId: data.id?.toString(),
        amount: data.amount / 100,
        email: data.customer?.email,
        gateway: "paystack",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.message;
      throw { status: 502, message: `Paystack verification failed: ${message}` };
    }
  }

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
    this.requireConfig("Flutterwave", { FLUTTERWAVE_SECRET_KEY });
    try {
      const response = await axios.post(
        "https://api.flutterwave.com/v3/payments",
        {
          tx_ref: transactionRef,
          amount: Number(amountNaira),
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
            userId: userId?.toString(),
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

  async _verifyFlutterwave(transactionRef) {
    this.requireConfig("Flutterwave", { FLUTTERWAVE_SECRET_KEY });
    try {
      const response = await axios.get(
        `https://api.flutterwave.com/v3/transactions/verify_by_reference?tx_ref=${encodeURIComponent(transactionRef)}`,
        { headers: { Authorization: `Bearer ${FLUTTERWAVE_SECRET_KEY}` } }
      );

      const data = response.data.data;
      return {
        verified: data.status === "successful",
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

  async _initializeOpay({
    email,
    amountNaira,
    planId,
    userId,
    transactionRef,
    callbackPath = "/subscription/verify",
    callbackUrl,
    title = "NendPlay Payment",
    description = "NendPlay payment",
  }) {
    this.requireConfig("OPay", { OPAY_MERCHANT_ID, OPAY_SECRET_KEY, OPAY_INITIALIZE_URL });
    const redirectUrl = this.buildCallbackUrl({ callbackUrl, callbackPath, gateway: "opay", transactionRef });
    const payload = {
      reference: transactionRef,
      merchantId: OPAY_MERCHANT_ID,
      country: "NG",
      currency: "NGN",
      amount: {
        total: this.amountKobo(amountNaira),
        currency: "NGN",
      },
      product: {
        name: title,
        description,
      },
      callbackUrl: redirectUrl,
      returnUrl: redirectUrl,
      userInfo: {
        userEmail: email,
      },
      metadata: {
        planId,
        userId: userId?.toString(),
        gateway: "opay",
      },
    };

    try {
      const response = await axios.post(OPAY_INITIALIZE_URL, payload, {
        headers: {
          Authorization: `Bearer ${OPAY_SECRET_KEY}`,
          MerchantId: OPAY_MERCHANT_ID,
          PublicKey: OPAY_PUBLIC_KEY || "",
          "Content-Type": "application/json",
        },
      });

      const paymentUrl = this.extractPaymentUrl(response.data);
      if (!paymentUrl) {
        throw new Error("OPay did not return a payment URL");
      }

      return { paymentUrl, transactionRef, gateway: "opay" };
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      throw { status: 502, message: `OPay initialization failed: ${message}` };
    }
  }

  async _verifyOpay(transactionRef) {
    this.requireConfig("OPay", { OPAY_MERCHANT_ID, OPAY_SECRET_KEY, OPAY_VERIFY_URL });
    try {
      const response = await axios.post(
        OPAY_VERIFY_URL,
        {
          reference: transactionRef,
          orderNo: transactionRef,
          merchantId: OPAY_MERCHANT_ID,
        },
        {
          headers: {
            Authorization: `Bearer ${OPAY_SECRET_KEY}`,
            MerchantId: OPAY_MERCHANT_ID,
            PublicKey: OPAY_PUBLIC_KEY || "",
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data?.data || response.data?.result || response.data;
      const status = this.extractStatus(response.data);
      return {
        verified: SUCCESS_STATUSES.has(status),
        gatewayTransactionId: this.extractGatewayTransactionId(response.data) || transactionRef,
        amount: this.normalizeAmountNaira(data?.amount),
        email: this.extractEmail(response.data),
        gateway: "opay",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      throw { status: 502, message: `OPay verification failed: ${message}` };
    }
  }

  async _initializePalmPay({
    email,
    amountNaira,
    planId,
    userId,
    transactionRef,
    callbackPath = "/subscription/verify",
    callbackUrl,
    title = "NendPlay Payment",
    description = "NendPlay payment",
  }) {
    this.requireConfig("PalmPay", { PALMPAY_MERCHANT_ID, PALMPAY_SECRET_KEY, PALMPAY_INITIALIZE_URL });
    const redirectUrl = this.buildCallbackUrl({ callbackUrl, callbackPath, gateway: "palmpay", transactionRef });
    const payload = {
      appId: PALMPAY_APP_ID,
      merchantId: PALMPAY_MERCHANT_ID,
      orderId: transactionRef,
      orderNo: transactionRef,
      reference: transactionRef,
      amount: this.amountKobo(amountNaira),
      currency: "NGN",
      title,
      description,
      notifyUrl: redirectUrl,
      callbackUrl: redirectUrl,
      redirectUrl,
      customer: { email },
      metadata: {
        planId,
        userId: userId?.toString(),
        gateway: "palmpay",
      },
    };

    try {
      const response = await axios.post(PALMPAY_INITIALIZE_URL, payload, {
        headers: {
          Authorization: `Bearer ${PALMPAY_SECRET_KEY}`,
          AppId: PALMPAY_APP_ID || "",
          MerchantId: PALMPAY_MERCHANT_ID,
          PublicKey: PALMPAY_PUBLIC_KEY || "",
          "Content-Type": "application/json",
        },
      });

      const paymentUrl = this.extractPaymentUrl(response.data);
      if (!paymentUrl) {
        throw new Error("PalmPay did not return a payment URL");
      }

      return { paymentUrl, transactionRef, gateway: "palmpay" };
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      throw { status: 502, message: `PalmPay initialization failed: ${message}` };
    }
  }

  async _verifyPalmPay(transactionRef) {
    this.requireConfig("PalmPay", { PALMPAY_MERCHANT_ID, PALMPAY_SECRET_KEY, PALMPAY_VERIFY_URL });
    try {
      const response = await axios.post(
        PALMPAY_VERIFY_URL,
        {
          appId: PALMPAY_APP_ID,
          merchantId: PALMPAY_MERCHANT_ID,
          orderId: transactionRef,
          orderNo: transactionRef,
          reference: transactionRef,
        },
        {
          headers: {
            Authorization: `Bearer ${PALMPAY_SECRET_KEY}`,
            AppId: PALMPAY_APP_ID || "",
            MerchantId: PALMPAY_MERCHANT_ID,
            PublicKey: PALMPAY_PUBLIC_KEY || "",
            "Content-Type": "application/json",
          },
        }
      );

      const data = response.data?.data || response.data?.result || response.data;
      const status = this.extractStatus(response.data);
      return {
        verified: SUCCESS_STATUSES.has(status),
        gatewayTransactionId: this.extractGatewayTransactionId(response.data) || transactionRef,
        amount: this.normalizeAmountNaira(data?.amount),
        email: this.extractEmail(response.data),
        gateway: "palmpay",
      };
    } catch (err) {
      const message = err.response?.data?.message || err.response?.data?.error || err.message;
      throw { status: 502, message: `PalmPay verification failed: ${message}` };
    }
  }

  verifyPaystackWebhook(rawBody, signature) {
    const hash = crypto
      .createHmac("sha512", PAYSTACK_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");
    return hash === signature;
  }

  verifyFlutterwaveWebhook(signature) {
    return signature === FLUTTERWAVE_WEBHOOK_SECRET;
  }
}

module.exports = new PaymentService();
module.exports.SUPPORTED_PAYMENT_GATEWAYS = SUPPORTED_PAYMENT_GATEWAYS;

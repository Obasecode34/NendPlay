const crypto = require("crypto");
const axios = require("axios");
const User = require("../models/User");
const RewardLedger = require("../models/RewardLedger");

const SIGNATURE_PARAM = "signature=";
const KEY_ID_PARAM = "key_id=";
const DEFAULT_KEYS_URL = "https://www.gstatic.com/admob/reward/verifier-keys.json";
const MAX_CALLBACK_AGE_MS = 24 * 60 * 60 * 1000;

let cachedKeys = null;
let cachedKeysAt = 0;

function decodeWebSafeBase64(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  return Buffer.from(padded, "base64");
}

function getRawQuery(req) {
  const originalUrl = req.originalUrl || req.url || "";
  const queryStart = originalUrl.indexOf("?");
  if (queryStart === -1) return "";
  return originalUrl.slice(queryStart + 1);
}

function hasSignedQuery(rawQuery = "") {
  return rawQuery.includes(SIGNATURE_PARAM) && rawQuery.includes(KEY_ID_PARAM);
}

function parseSignedQuery(rawQuery) {
  const signatureIndex = rawQuery.indexOf(SIGNATURE_PARAM);
  if (signatureIndex === -1) {
    throw { status: 400, message: "Missing AdMob SSV signature" };
  }

  const signedContent = rawQuery.slice(0, signatureIndex - 1);
  const signatureAndKey = rawQuery.slice(signatureIndex);
  const keyIdIndex = signatureAndKey.indexOf(KEY_ID_PARAM);
  if (keyIdIndex === -1) {
    throw { status: 400, message: "Missing AdMob SSV key_id" };
  }

  const signature = signatureAndKey.slice(SIGNATURE_PARAM.length, keyIdIndex - 1);
  const keyId = signatureAndKey.slice(keyIdIndex + KEY_ID_PARAM.length);
  if (!signedContent || !signature || !keyId) {
    throw { status: 400, message: "Malformed AdMob SSV callback" };
  }

  return { signedContent, signature, keyId };
}

async function fetchAdMobKeys() {
  const now = Date.now();
  if (cachedKeys && now - cachedKeysAt < MAX_CALLBACK_AGE_MS) return cachedKeys;

  const keysUrl = process.env.ADMOB_SSV_KEYS_URL || DEFAULT_KEYS_URL;
  const { data } = await axios.get(keysUrl, { timeout: 10000 });
  const keys = new Map();
  (data.keys || []).forEach((key) => {
    if (key.keyId && key.pem) keys.set(String(key.keyId), key.pem);
  });

  if (!keys.size) {
    throw { status: 500, message: "Could not load AdMob SSV public keys" };
  }

  cachedKeys = keys;
  cachedKeysAt = now;
  return keys;
}

async function verifySignature(req) {
  const rawQuery = getRawQuery(req);
  const { signedContent, signature, keyId } = parseSignedQuery(rawQuery);
  const keys = await fetchAdMobKeys();
  const publicKey = keys.get(String(keyId));
  if (!publicKey) {
    throw { status: 400, message: "Unknown AdMob SSV key_id" };
  }

  const verifier = crypto.createVerify("sha256");
  verifier.update(Buffer.from(signedContent, "utf8"));
  verifier.end();

  const valid = verifier.verify(publicKey, decodeWebSafeBase64(signature));
  if (!valid) {
    throw { status: 400, message: "Invalid AdMob SSV signature" };
  }
}

function parseCoinAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 1) return 1;
  return amount >= 2 ? 2 : 1;
}

function validateTimestamp(query) {
  let timestamp = Number(query.timestamp);
  if (Number.isFinite(timestamp)) {
    if (timestamp > 100000000000000) timestamp = Math.floor(timestamp / 1000);
    const age = Math.abs(Date.now() - timestamp);
    if (age > MAX_CALLBACK_AGE_MS) {
      throw { status: 400, message: "AdMob SSV callback timestamp is too old" };
    }
  }
}

function isSetupProbe(query = {}) {
  return !query.transaction_id || !query.user_id;
}

function validateRewardCallback(query) {
  if (!query.transaction_id) {
    throw { status: 400, message: "Missing AdMob SSV transaction_id" };
  }
  if (!query.user_id) {
    throw { status: 400, message: "Missing AdMob SSV user_id" };
  }
  validateTimestamp(query);
}

class AdMobSsvService {
  async handleRewardCallback(req) {
    const rawQuery = getRawQuery(req);

    if (!rawQuery || !hasSignedQuery(rawQuery)) {
      return {
        setupCheck: true,
        duplicate: false,
        coins: 0,
        balanceAfter: null,
        message: "AdMob SSV endpoint is reachable",
      };
    }

    await verifySignature(req);
    validateTimestamp(req.query);

    if (isSetupProbe(req.query)) {
      return {
        setupCheck: true,
        duplicate: false,
        coins: 0,
        balanceAfter: null,
        message: "AdMob SSV signature verified",
      };
    }

    validateRewardCallback(req.query);

    const existing = await RewardLedger.findOne({
      source: "admob_ssv",
      "metadata.transactionId": req.query.transaction_id,
    });
    if (existing) {
      return { duplicate: true, coins: 0, balanceAfter: existing.balanceAfter };
    }

    const user = await User.findById(req.query.user_id);
    if (!user || !user.isActive) {
      throw { status: 404, message: "AdMob SSV user not found" };
    }

    const coins = parseCoinAmount(req.query.reward_amount);
    user.rewardCoins = (user.rewardCoins || 0) + coins;
    await user.save();

    await RewardLedger.create({
      userId: user._id,
      type: "earn",
      source: "admob_ssv",
      coins,
      balanceAfter: user.rewardCoins || 0,
      metadata: {
        transactionId: req.query.transaction_id,
        adUnit: req.query.ad_unit,
        adNetwork: req.query.ad_network,
        rewardAmount: req.query.reward_amount,
        rewardItem: req.query.reward_item,
        customData: req.query.custom_data,
        timestamp: req.query.timestamp,
      },
    });

    return { duplicate: false, coins, balanceAfter: user.rewardCoins || 0 };
  }
}

module.exports = new AdMobSsvService();

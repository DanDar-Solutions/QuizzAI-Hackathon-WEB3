import { ethers } from "ethers";

// deterministic concat: use '|' delimiter and trailing '|'
export function concatAnswers(arr) {
  return arr.join("|") + "|";
}

// compute player's commit: keccak256(utf8Bytes(concatAnswers + salt))
export async function computePlayerCommit(answersArray, salt = null) {
  const concatenated = concatAnswers(answersArray);
  const saltStr = salt ? String(salt) : await generateRandomSalt();
  const packed = ethers.utils.toUtf8Bytes(concatenated + saltStr);
  return ethers.utils.keccak256(packed);
}

export async function generateRandomSalt() {
  // 16 bytes hex string
  return "0x" + await cryptoRandomHex(16);
}

async function cryptoRandomHex(n) {
  // use Node crypto
  const crypto = await awaitSafeCrypto();
  return crypto.randomBytes(n).toString("hex");
}

// tiny helper to allow top-level import in both CJS/ESM contexts
async function awaitSafeCrypto() {
  try {
    const m = await import("crypto");
    return m.default || m;
  } catch (e) {
    return require("crypto");
  }
}
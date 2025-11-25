// backend/signCorrectAnswers.js
import dotenv from "dotenv";
dotenv.config();

import { ethers } from "ethers";

if (!process.env.VALIDATOR_PRIVATE_KEY) {
  console.error("Set VALIDATOR_PRIVATE_KEY in .env");
  process.exit(1);
}

const wallet = new ethers.Wallet(process.env.VALIDATOR_PRIVATE_KEY);

function concatAnswers(arr) {
  return arr.join("|") + "|";
}

export function computeMessageHash(quizHash, correctAnswers) {
  const concat = concatAnswers(correctAnswers);
  const quizHashBytes = ethers.getBytes(quizHash);
  const concatBytes = ethers.toUtf8Bytes(concat);
  const packed = ethers.concat([quizHashBytes, concatBytes]);
  return ethers.keccak256(packed);
}

async function main() {
  // Provide quizHash and answers in env or change here
  const quizHash = process.env.QUIZ_HASH;
  const answers = (process.env.CORRECT_ANSWERS || "A|B|C|D|A").split("|").filter(Boolean);

  if (!quizHash) {
    console.error("Set QUIZ_HASH in .env or edit the script");
    process.exit(1);
  }

  const messageHash = computeMessageHash(quizHash, answers);
  const arrayified = ethers.getBytes(messageHash);
  const signature = await wallet.signMessage(arrayified);
  console.log("messageHash:", messageHash);
  console.log("signature:", signature);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

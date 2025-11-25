import fs from "fs";
import Groq from "groq-sdk";
import dotenv from "dotenv";
import stringify from "json-stable-stringify";
import { ethers } from "ethers";
import { concatAnswers } from "./helpers.js";

dotenv.config();

const rules = fs.readFileSync("./infinitequiz_rules.txt", "utf8");
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

// generate quiz content via AI and compute deterministic hash
export async function generateQuizAndHash() {
  // ask AI to generate JSON only
  const completion = await groq.chat.completions.create({
    model: MODEL,
    temperature: 0,
    messages: [
      { role: "system", content: rules },
      { role: "user", content: "Generate a new Infinite Quiz (5 questions). Return only the JSON object." }
    ]
  });

  const content = completion.choices[0].message.content;

  // parse JSON safely
  let quizJson;
  try {
    quizJson = JSON.parse(content);
  } catch (e) {
    throw new Error("AI output not valid JSON: " + e.message + " — output: " + content);
  }

  // stable stringify (deterministic)
  const jsonStr = stringify(quizJson);
  const quizHash = ethers.utils.keccak256(ethers.utils.toUtf8Bytes(jsonStr));

  // return JSON plus hash (quizHash is bytes32 hex)
  return { quiz: quizJson, quizHash, serialized: jsonStr };
}

// sign correct answers: returns Ethereum signed message (0x...)
export async function signCorrectAnswers(validatorPrivateKey, quizHash, correctAnswers) {
  if (!validatorPrivateKey) throw new Error("VALIDATOR_PRIVATE_KEY is not set.");
  const wallet = new ethers.Wallet(validatorPrivateKey);

  // contract expects messageHash = keccak256(abi.encodePacked(quizHash, concatAnswers(answers)))
  // We'll replicate the contract flow using ethers: encodePacked = concatenation of bytes
  const concatenated = concatAnswers(correctAnswers); // e.g., "A|B|C|"
  // encode like abi.encodePacked(quizHash, concatenated)
  const quizHashBytes = ethers.utils.arrayify(quizHash);
  const concatenatedBytes = ethers.utils.toUtf8Bytes(concatenated);
  const packed = ethers.utils.concat([quizHashBytes, concatenatedBytes]);
  const messageHash = ethers.utils.keccak256(packed);

  // sign as Ethereum Signed Message (wallet.signMessage(arrayifiedHash))
  const arrayified = ethers.utils.arrayify(messageHash);
  const signature = await wallet.signMessage(arrayified);
  return signature;
}

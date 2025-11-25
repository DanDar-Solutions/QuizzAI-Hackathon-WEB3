import dotenv from "dotenv";
dotenv.config();

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { generateQuizAndHash, signCorrectAnswers, splitConcatAnswers } from "./AI.js";
import { setQuizHashOnChain, publishCorrectAnswersOnChain } from "./blockchain.js";
import { computePlayerCommit } from "./helpers.js";

const app = express();
app.use(cors());
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Endpoint: generate quiz (owner/admin)
app.post("/quiz/generate", async (req, res) => {
  try {
    // generate quiz JSON, deterministic
    const quiz = await generateQuizAndHash();

    // optionally push quizHash on-chain (owner must be configured)
    if (process.env.RPC_URL && process.env.OWNER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
      await setQuizHashOnChain(quiz.quizHash);
      // returns tx or nothing depending on implementation
    }

    // return quiz JSON to caller (frontend or admin)
    res.json(quiz);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint: after round ends — backend / admin triggers publish of correct answers
app.post("/quiz/publish", async (req, res) => {
  // expected body: { quizHash: "0x...", correctAnswers: ["A","B",..."] }
  try {
    const { quizHash, correctAnswers } = req.body;
    if (!quizHash || !correctAnswers) return res.status(400).send("missing fields");

    // sign with validator private key (local)
    const signature = await signCorrectAnswers(process.env.VALIDATOR_PRIVATE_KEY, quizHash, correctAnswers);

    // optionally call publishCorrectAnswers on-chain (owner)
    if (process.env.RPC_URL && process.env.OWNER_PRIVATE_KEY && process.env.CONTRACT_ADDRESS) {
      await publishCorrectAnswersOnChain(correctAnswers, signature);
    }

    res.json({ quizHash, correctAnswers, signature });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || String(err) });
  }
});

// Endpoint: player compute commit locally or server-assisted
app.post("/player/commit", (req, res) => {
  // body: { answers: ["A","C","B","D","B"], salt: "0xabc" (optional) }
  const { answers, salt } = req.body;
  if (!answers) return res.status(400).send("answers required");
  try {
    const commit = computePlayerCommit(answers, salt || null);
    res.json({ commit });
  } catch (err) {
    res.status(500).json({ error: err.message || String(err) });
  }
});

// health
app.get("/health", (req, res) => res.json({ ok: true, screenshotPath: "/mnt/data/d2d01a22-acfd-46ba-a0bc-486d708a96a7.png" }));

app.listen(PORT, () => console.log(`InfiniteQuiz service running on ${PORT}`));
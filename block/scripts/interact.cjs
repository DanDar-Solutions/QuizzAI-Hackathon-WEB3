// scripts/interact.cjs
const hre = require("hardhat");

async function main() {
  const [owner, player, validator] = await hre.ethers.getSigners();

  // Replace with your deployed contract address or set CONTRACT_ADDRESS env var.
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const iq = await hre.ethers.getContractAt("InfiniteQuizSingle", contractAddress, owner);

  console.log("Using contract:", iq.target);

  // -------------------------
  // 0) Prepare a deterministic sample quiz JSON (must be canonicalized offchain too)
  const sampleQuiz = {
    quiz_id: "demo-uuid-1",
    round: 1,
    questions: [
      { id: 1, category: "Science", difficulty: "easy", question: "What is H2O?", options: ["A", "B", "C", "D"], correct_answer: "A", explanation: "Water" },
      { id: 2, category: "History", difficulty: "easy", question: "Year 1066 event?", options: ["A","B","C","D"], correct_answer: "B", explanation: "Norman Conquest" },
      { id: 3, category: "Geography", difficulty: "medium", question: "Capital of France?", options: ["A","B","C","D"], correct_answer: "C", explanation: "Paris" },
      { id: 4, category: "Math", difficulty: "medium", question: "2+2=?", options: ["A","B","C","D"], correct_answer: "D", explanation: "4" },
      { id: 5, category: "Space", difficulty: "hard", question: "1 AU equals?", options: ["A","B","C","D"], correct_answer: "B", explanation: "Distance from Earth to Sun" }
    ],
    metadata: { difficultyWeight: 1.0, timeLimitSeconds: 45, questionCount: 5 }
  };

  // IMPORTANT: this must match the canonical JSON used by your AI generator.
  const jsonString = JSON.stringify(sampleQuiz); // use stable stringify in production
  const quizHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes(jsonString));
  console.log("quizHash:", quizHash);

  // -------------------------
  // 1) Owner sets quizHash (opens commit phase)
  const tx1 = await iq.connect(owner).setQuizHash(quizHash);
  await tx1.wait();
  console.log("setQuizHash done");

  // -------------------------
  // 2) Player enters game and pays stake
  const stake = hre.ethers.parseEther("0.01"); // example
  const tx2 = await iq.connect(player).enterGame({ value: stake });
  await tx2.wait();
  console.log("player entered with stake:", stake.toString());

  // -------------------------
  // 3) Player chooses answers and salt, compute commit
  // Use same concat function as contract: "A|B|C|D|E|"
  const answers = ["A", "B", "C", "D", "A"];
  const salt = "random-salt-123"; // in real UI generate securely per player
  const concatAnswers = answers.join("|") + "|";
  const commitPacked = hre.ethers.toUtf8Bytes(concatAnswers + salt);
  const commitHash = hre.ethers.keccak256(commitPacked);
  console.log("player commitHash:", commitHash);

  // submit commit with timeTaken (example 10s)
  const timeTaken = 10;
  const tx3 = await iq.connect(player).submitCommit(commitHash, timeTaken);
  await tx3.wait();
  console.log("commit submitted");

  // -------------------------
  // 4) Validator (off-chain) signs correct answers
  // We'll simulate validator signing using the validator signer available from Hardhat:
  const correctAnswers = ["A", "B", "C", "D", "A"]; // validator result from AI
  const concatCorrect = correctAnswers.join("|") + "|";
  // message hash = keccak256(abi.encodePacked(quizHash, concatAnswers))
  const quizHashBytes = hre.ethers.getBytes(quizHash);
  const concatBytes = hre.ethers.toUtf8Bytes(concatCorrect);
  const packed = hre.ethers.concat([quizHashBytes, concatBytes]);
  const messageHash = hre.ethers.keccak256(packed);
  const arrayified = hre.ethers.getBytes(messageHash);
  const signature = await validator.signMessage(arrayified);
  console.log("validator signature:", signature);

  // 5) Owner publishes correct answers with signature
  const tx4 = await iq.connect(owner).publishCorrectAnswers(correctAnswers, signature);
  await tx4.wait();
  console.log("publishCorrectAnswers done");

  // 6) Owner moves to reveal phase
  const tx5 = await iq.connect(owner).startRevealPhase();
  await tx5.wait();
  console.log("startRevealPhase");

  // 7) Player reveals answers and salt
  const tx6 = await iq.connect(player).revealAnswers(correctAnswers, salt); // use same answers & salt used for commit
  const receipt6 = await tx6.wait();
  console.log("revealAnswers tx mined", receipt6.transactionHash);

  // 8) Check balance of player to confirm payout (optional)
  const bal = await hre.ethers.provider.getBalance(player.address);
  console.log("player balance after payout:", bal.toString());

  // Done
  console.log("Round complete");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

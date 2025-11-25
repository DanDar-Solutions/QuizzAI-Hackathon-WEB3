// test/singleFlow.test.js
import hardhat from "hardhat";
const { ethers } = hardhat;
import { expect } from "chai";

describe("InfiniteQuizSingle full round", function () {
  it("runs full single-player round end-to-end", async function () {
    const [owner, player, validator] = await ethers.getSigners();

    // Deploy contract with validator address
    const Factory = await ethers.getContractFactory("InfiniteQuizSingle");
    const contract = await Factory.deploy(validator.address);
    await contract.waitForDeployment();

    // Fund the contract so it can pay out rewards
    // Give a larger balance than any expected reward
    await owner.sendTransaction({
      to: contract.target,
      value: ethers.parseEther("5") // 5 ETH for tests
    });

    // Simulate AI generating quiz hash and owner setting it
    const sampleQuiz = { quiz_id: "test-1", round: 1, questions: [], metadata: { questionCount: 5 } };
    const quizSerialized = JSON.stringify(sampleQuiz);
    const quizHash = ethers.keccak256(ethers.toUtf8Bytes(quizSerialized));
    await contract.connect(owner).setQuizHash(quizHash);

    // Player enters game (stake paid)
    const stake = ethers.parseEther("0.1");
    await contract.connect(player).enterGame({ value: stake });

    // Player prepares answers and salt, compute commit
    const answers = ["A", "B", "C", "D", "A"];
    const salt = "salt-test-1";
    const concat = answers.join("|") + "|";
    const commitPacked = ethers.toUtf8Bytes(concat + salt);
    const commitHash = ethers.keccak256(commitPacked);

    // Submit commit with timeTaken (<= contract's implicit limit)
    await contract.connect(player).submitCommit(commitHash, 10);

    // Validator signs correct answers off-chain (simulate with validator signer)
    const concatCorrect = answers.join("|") + "|";
    const quizHashBytes = ethers.getBytes(quizHash);
    const concatBytes = ethers.toUtf8Bytes(concatCorrect);
    const packed = ethers.concat([quizHashBytes, concatBytes]);
    const messageHash = ethers.keccak256(packed);
    const arrayified = ethers.getBytes(messageHash);
    const signature = await validator.signMessage(arrayified);

    // Owner publishes correct answers (validator signature required)
    await contract.connect(owner).publishCorrectAnswers(answers, signature);

    // Owner starts reveal phase
    await contract.connect(owner).startRevealPhase();

    // Capture player balance before reveal
    const before = await ethers.provider.getBalance(player.address);

    // Player reveals answers and salt -> triggers payout
    const tx = await contract.connect(player).revealAnswers(answers, salt);
    await tx.wait();

    const after = await ethers.provider.getBalance(player.address);
    expect(after).to.be.gt(before);

    // Verify player state stored
    const stored = await contract.player();
    expect(stored.revealed).to.equal(true);
  });
});

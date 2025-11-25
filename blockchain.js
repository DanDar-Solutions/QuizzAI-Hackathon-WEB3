import dotenv from "dotenv";
dotenv.config();
import { ethers } from "ethers";

const RPC = process.env.RPC_URL;
const provider = RPC ? new ethers.JsonRpcProvider(RPC) : null;
const ownerWallet = (process.env.OWNER_PRIVATE_KEY && provider) ? new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider) : null;
const contractAddress = process.env.CONTRACT_ADDRESS || null;

// minimal ABI for required contract functions
const ABI = [
  "function setQuizHash(bytes32 _quizHash) external",
  "function publishCorrectAnswers(string[] calldata answers, bytes calldata signature) external"
];

function getContract(signer) {
  if (!contractAddress) throw new Error("CONTRACT_ADDRESS not set in env");
  return new ethers.Contract(contractAddress, ABI, signer);
}

export async function setQuizHashOnChain(quizHash) {
  if (!ownerWallet) throw new Error("owner wallet or provider not configured");
  const c = getContract(ownerWallet);
  const tx = await c.setQuizHash(quizHash);
  const receipt = await tx.wait();
  return receipt;
}

export async function publishCorrectAnswersOnChain(answers, signature) {
  if (!ownerWallet) throw new Error("owner wallet or provider not configured");
  const c = getContract(ownerWallet);
  const tx = await c.publishCorrectAnswers(answers, signature);
  const receipt = await tx.wait();
  return receipt;
}

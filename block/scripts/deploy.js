import hre from "hardhat";


async function main() {
  const InfiniteQuizSingle = await hre.ethers.getContractFactory("InfiniteQuizSingle");

  // LOCALHOST → use your first account as validator
  const [validator] = await hre.ethers.getSigners();

  const quiz = await InfiniteQuizSingle.deploy(validator.address);

  await quiz.waitForDeployment();

  console.log("InfiniteQuizSingle deployed to:", await quiz.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});


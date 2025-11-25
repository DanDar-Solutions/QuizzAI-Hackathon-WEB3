// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
  InfiniteQuizSingle.sol

  Single-player commit->reveal quiz game.

  Flow (single-player round):
    1. Owner calls setQuizHash(...) (off-chain AI generated quiz JSON hashed)
    2. Player calls enterGame() and sends stake (payable)
    3. Player calls submitCommit(bytes32 commitHash) during commit phase
    4. Owner calls publishCorrectAnswers(string[] answers, bytes signature) after round ends (signed by validator)
    5. Owner calls startRevealPhase()
    6. Player calls revealAnswers(string[] answers, string salt)
    7. Contract verifies commit, computes score and reward, and pays the player
*/

contract InfiniteQuizSingle {
    address public owner;
    address public validator; // off-chain AI signer

    bytes32 public quizHash; // keccak256 of canonical JSON string
    bool public commitPhase;
    bool public revealPhase;
    uint256 public questionCount = 5;

    struct PlayerData {
        bytes32 commitHash;
        uint256 stake;
        uint32 timeTaken;
        bool committed;
        bool revealed;
    }

    PlayerData public player; // single player per round
    address public playerAddress;

    string[] public correctAnswers; // stored when published (must be signed by validator)
    bool public correctAnswersPublished;

    event QuizHashSet(bytes32 quizHash);
    event PlayerEntered(address player, uint256 stake);
    event CommitSubmitted(address player, bytes32 commitHash, uint32 timeTaken);
    event CorrectAnswersPublished(address publisher);
    event PlayerRevealed(address player, int256 score, uint256 reward);
    event RoundReset();

    modifier onlyOwner() {
        require(msg.sender == owner, "owner only");
        _;
    }

    modifier onlyPlayer() {
        require(msg.sender == playerAddress, "only player");
        _;
    }

    modifier inCommitPhase() {
        require(commitPhase, "not in commit phase");
        _;
    }

    modifier inRevealPhase() {
        require(revealPhase, "not in reveal phase");
        _;
    }

    constructor(address _validator) {
        owner = msg.sender;
        validator = _validator;
        commitPhase = false;
        revealPhase = false;
        correctAnswersPublished = false;
    }

    // Owner sets quizHash and opens commit phase for a new round
    function setQuizHash(bytes32 _quizHash) external onlyOwner {
        require(!commitPhase && !revealPhase, "round in progress");
        quizHash = _quizHash;
        commitPhase = true;
        correctAnswersPublished = false;
        delete correctAnswers;
        // reset player slot
        player = PlayerData({commitHash: bytes32(0), stake: 0, timeTaken: 0, committed: false, revealed: false});
        playerAddress = address(0);
        emit QuizHashSet(_quizHash);
    }

    // Single player enters the game by sending ETH stake
    function enterGame() external payable inCommitPhase {
        require(playerAddress == address(0), "player already entered");
        require(msg.value > 0, "stake required");
        playerAddress = msg.sender;
        player.stake = msg.value;
        emit PlayerEntered(msg.sender, msg.value);
    }

    // Player submits commit (hash of answers concatenated + salt) and timeTaken (seconds)
    function submitCommit(bytes32 commitHash, uint32 _timeTaken) external onlyPlayer inCommitPhase {
        require(playerAddress != address(0), "no player");
        require(!player.committed, "already committed");
        player.commitHash = commitHash;
        player.timeTaken = _timeTaken;
        player.committed = true;
        emit CommitSubmitted(msg.sender, commitHash, _timeTaken);
    }

    // Owner publishes correct answers — must be signed by validator
    // The validator should sign: keccak256(abi.encodePacked(quizHash, concatAnswers(answers)))
    function publishCorrectAnswers(string[] calldata answers, bytes calldata signature) external onlyOwner {
        require(commitPhase, "not accepting publish now");
        require(answers.length == questionCount, "answers length mismatch");

        // recreate message hash as contract expects
        bytes32 messageHash = keccak256(abi.encodePacked(quizHash, _concatAnswers(answers)));
        address signer = _recoverSigner(messageHash, signature);
        require(signer == validator, "invalid validator signature");

        // store answers on-chain
        delete correctAnswers;
        for (uint256 i = 0; i < answers.length; i++) {
            correctAnswers.push(answers[i]);
        }
        correctAnswersPublished = true;
        emit CorrectAnswersPublished(msg.sender);
    }

    // Owner moves contract into reveal phase (player may reveal after this)
    function startRevealPhase() external onlyOwner inCommitPhase {
        require(player.committed, "player not committed");
        commitPhase = false;
        revealPhase = true;
    }

    // Player reveals answers and salt. Contract verifies commit and computes reward.
    function revealAnswers(string[] calldata answers, string calldata salt) external onlyPlayer inRevealPhase {
        require(correctAnswersPublished, "correct answers not published");
        require(answers.length == questionCount, "answers length mismatch");
        require(player.committed, "player didn't commit");
        require(!player.revealed, "already revealed");

        // recompute commit hash = keccak256(abi.encodePacked(concatAnswers(answers), salt))
        bytes32 recomputed = keccak256(abi.encodePacked(_concatAnswers(answers), salt));
        require(recomputed == player.commitHash, "commit mismatch");

        // compute correctness
        uint256 correct = 0;
        for (uint256 i = 0; i < answers.length; i++) {
            if (keccak256(bytes(answers[i])) == keccak256(bytes(correctAnswers[i]))) {
                correct++;
            }
        }

        // scoring: score = correct (0..questionCount)
        int256 score = int256(int(correct));

        // Reward calculation (example policy):
        // reward = stake + (stake * correct / questionCount)
        // so 0 correct => reward = stake (refund only)
        // all correct => reward = stake * 2
        uint256 reward = player.stake;
        if (correct > 0) {
            reward += (player.stake * correct) / questionCount;
        }

        player.revealed = true;
        revealPhase = false; // round ends after reveal

        // transfer reward. If transfer fails, revert to keep funds safe.
        (bool ok, ) = payable(playerAddress).call{value: reward}("");
        require(ok, "payout failed");

        emit PlayerRevealed(playerAddress, score, reward);
    }

    // Owner can withdraw remaining funds (if any) after round ends
    function withdraw(address payable to) external onlyOwner {
        require(!commitPhase && !revealPhase, "round in progress");
        uint256 bal = address(this).balance;
        (bool ok, ) = to.call{value: bal}("");
        require(ok, "withdraw failed");
    }

    // Utility: deterministic concatenation used by both backend and contract
    // Example: answers ["A","B"] => "A|B|"
    function _concatAnswers(string[] memory arr) internal pure returns (string memory) {
        bytes memory b;
        for (uint256 i = 0; i < arr.length; i++) {
            b = abi.encodePacked(b, arr[i], "|");
        }
        return string(b);
    }

    // ECDSA recover assuming the validator signed the 32-byte message hash as an Ethereum Signed Message
    function _recoverSigner(bytes32 messageHash, bytes memory signature) internal pure returns (address) {
        bytes32 ethPrefixed = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash));
        require(signature.length == 65, "invalid sig length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(signature, 0x20))
            s := mload(add(signature, 0x40))
            v := byte(0, mload(add(signature, 0x60)))
        }
        if (v < 27) v += 27;
        return ecrecover(ethPrefixed, v, r, s);
    }

    // receive ETH fallback
    receive() external payable {}
}
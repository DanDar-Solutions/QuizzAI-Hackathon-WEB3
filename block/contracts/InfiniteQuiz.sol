// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/*
    InfiniteQuiz — Commit → Reveal quiz game

    Flow:
      1. Player commits hash of answers
      2. Player reveals answers + salt
      3. Contract verifies hash match
*/

contract InfiniteQuiz {
    struct PlayerData {
        bytes32 commitHash;
        bool committed;
        bool revealed;
        string[5] answers;
        string salt;
    }

    mapping(address => PlayerData) public players;

    bool public commitPhase = true;
    bool public revealPhase = false;

    modifier onlyCommit() {
        require(commitPhase, "Commit phase ended");
        _;
    }

    modifier onlyReveal() {
        require(revealPhase, "Reveal phase not active");
        _;
    }

    function submitCommit(bytes32 commitHash) external onlyCommit {
        players[msg.sender].commitHash = commitHash;
        players[msg.sender].committed = true;
    }

    function startRevealPhase() external {
        require(commitPhase, "Already in reveal");
        commitPhase = false;
        revealPhase = true;
    }

    function revealAnswers(
        string[5] calldata answers,
        string calldata salt
    ) external onlyReveal {
        PlayerData storage p = players[msg.sender];

        require(p.committed, "Not committed");
        require(!p.revealed, "Already revealed");

        bytes32 recomputed = keccak256(
            abi.encodePacked(
                answers[0],
                answers[1],
                answers[2],
                answers[3],
                answers[4],
                salt
            )
        );

        require(recomputed == p.commitHash, "Hash mismatch");

        p.revealed = true;
        p.salt = salt;

        for (uint256 i = 0; i < 5; i++) {
            p.answers[i] = answers[i];
        }
    }

}
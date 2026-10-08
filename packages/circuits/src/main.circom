pragma circom 2.0.0;

include "vote.circom";

// electionId 與 voteHash 必須明確宣告為 public，
// 它們才會進入 publicSignals 並被納入驗證等式。
component main {public [electionId, voteHash]} = Vote();

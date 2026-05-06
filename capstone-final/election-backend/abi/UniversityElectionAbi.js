module.exports = [
  "function eligibilitySigner() view returns (address)",
  "function getEligibilityDigest(uint256 _electionId, address _voter) view returns (bytes32)",
  "function isEligibilitySignatureValid(uint256 _electionId, address _voter, bytes _signature) view returns (bool)"
];
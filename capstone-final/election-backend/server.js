require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { ethers } = require("ethers");
const universityElectionAbi = require("./abi/UniversityElectionAbi");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const RPC_URL = process.env.RPC_URL;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS;

if (!RPC_URL || !PRIVATE_KEY || !CONTRACT_ADDRESS) {
  console.error("Missing environment variables in .env");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(RPC_URL);
const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
const contract = new ethers.Contract(CONTRACT_ADDRESS, universityElectionAbi, provider);

app.get("/health", async (req, res) => {
  try {
    const network = await provider.getNetwork();
    const contractSigner = await contract.eligibilitySigner();

    res.json({
      ok: true,
      backendWallet: wallet.address,
      contractAddress: CONTRACT_ADDRESS,
      contractEligibilitySigner: contractSigner,
      rpcUrl: RPC_URL,
      chainId: network.chainId.toString(),
      signerMatches: wallet.address.toLowerCase() === contractSigner.toLowerCase()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.post("/api/sign-eligibility", async (req, res) => {
  try {
    const { electionId, voterAddress } = req.body;

    if (electionId === undefined || !voterAddress) {
      return res.status(400).json({
        ok: false,
        error: "electionId and voterAddress are required"
      });
    }

    if (!ethers.isAddress(voterAddress)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid voterAddress"
      });
    }

    const contractSigner = await contract.eligibilitySigner();

    if (wallet.address.toLowerCase() !== contractSigner.toLowerCase()) {
      return res.status(500).json({
        ok: false,
        error: "Backend wallet does not match contract eligibilitySigner"
      });
    }

    const digest = await contract.getEligibilityDigest(electionId, voterAddress);
    const signature = await wallet.signMessage(ethers.getBytes(digest));

    const valid = await contract.isEligibilitySignatureValid(
      electionId,
      voterAddress,
      signature
    );

    return res.json({
      ok: true,
      electionId,
      voterAddress,
      digest,
      signature,
      valid
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  console.log(`Backend signer: ${wallet.address}`);
});
import { createAztecNodeClient, Fr } from "@aztec/aztec.js";
import { createL1Clients } from "@aztec/ethereum";
import { getContract } from "viem";
import { sepolia } from "viem/chains";
import debug from "../l1-contracts/out/Debug.sol/Debug.json" with { type: "json" };

const L1_NODE_URL = "<ANY_SEPOLIA_NODE_RPC_URL>";
const L1_WALLET_MNEMONIC =
  "test test test test test test test test test test test junk";
const L1_DEBUG_CONTRACT_ADDRESS = "0xa90b5c2ac05f5c0389ffbe44bdff95197f817364";
const L2_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz";

async function main() {
  const { walletClient: l1Wallet } = createL1Clients(
    [L1_NODE_URL],
    L1_WALLET_MNEMONIC,
    sepolia,
  );
  const l2Node = createAztecNodeClient(L2_NODE_URL);

  // L2 tx that emitted this message:
  // https://www.aztecexplorer.xyz/tx/0x27c22f73983d12c40a9014b7df1a1e10d33a328c567e9c8f472694d9ed67b3c4
  const l2BlockNumber = 32890;
  const l2ToL1Message =
    "0x0051c6842d5dc7d3ef6b83e5317035beff72cf6c694b050d28a043b19f184f9d";

  const [l2ToL1MessageIndex, _siblingPath] =
    await l2Node.getL2ToL1MessageMembershipWitness(
      l2BlockNumber,
      Fr.fromHexString(l2ToL1Message),
    );
  const siblingPath = _siblingPath.toFields().map((x) => x.toString());

  console.log("l2BlockNumber: %s", l2BlockNumber);
  console.log("l2ToL1Message: %s", l2ToL1Message);
  console.log("l2ToL1MessageIndex: %s", l2ToL1MessageIndex);
  console.log("siblingPath: %s", siblingPath);

  // Source code for this contract:
  // https://gist.github.com/jasonxh/05ed1d92be3635bf1a71447a4254f2cb
  const debugContract = getContract({
    abi: debug.abi,
    address: L1_DEBUG_CONTRACT_ADDRESS,
    client: l1Wallet,
  });

  // ContractFunctionExecutionError: The contract function "verifyL2MessageMembership" reverted.
  // Error: MerkleLib__InvalidRoot(bytes32 expected, bytes32 actual, bytes32 leaf, uint256 leafIndex)
  //                              (0x00822527e74b5de5878e094f6423849127efdb15150045418f4dd20073a511c2, 0x0081c12e57992a74c899f1b8f6c52f22a1ac8ac1a42eadb277ccd3af5aa165b8, 0x0005317f81e937d8ba043ffc6cbfc25c48867b439910fa5687e28ac0f21bdd21, 10)
  await debugContract.read.verifyL2MessageMembership([
    (await l2Node.getL1ContractAddresses()).outboxAddress.toString(),
    l2BlockNumber,
    l2ToL1Message,
    l2ToL1MessageIndex,
    siblingPath,
  ]);
}

main();
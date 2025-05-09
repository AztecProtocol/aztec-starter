import { createAztecNodeClient, Fr, createPXEClient, waitForPXE } from "@aztec/aztec.js";
import { createL1Clients } from "@aztec/ethereum";
import { getContract } from "viem";
import { sepolia } from "viem/chains";
import debug from "../l1-contracts/out/Debug.sol/Debug.json" with { type: "json" };

const L1_NODE_URL = "https://sepolia.gateway.tenderly.co";
const L1_WALLET_MNEMONIC =
  "test test test test test test test test test test test junk";
const L1_DEBUG_CONTRACT_ADDRESS = "0x36C02dA8a0983159322a80FFE9F24b1acfF8B570";
const L2_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz";
// const L2_NODE_URL = "http://localhost:8080";


async function main() {
  const { walletClient: l1Wallet } = createL1Clients(
    [L1_NODE_URL],
    L1_WALLET_MNEMONIC,
    sepolia,
  );
  const l2Node = createAztecNodeClient(L2_NODE_URL);

  // L2 tx that emitted this message:
  // https://www.aztecexplorer.xyz/tx/0x27c22f73983d12c40a9014b7df1a1e10d33a328c567e9c8f472694d9ed67b3c4
  const l2BlockNumber = 29634;
  const l2ToL1Message =
    "0x0005317f81e937d8ba043ffc6cbfc25c48867b439910fa5687e28ac0f21bdd21";

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

  await debugContract.read.verifyL2MessageMembership([
    (await l2Node.getL1ContractAddresses()).outboxAddress.toString(),
    l2BlockNumber,
    l2ToL1Message,
    l2ToL1MessageIndex,
    siblingPath,
  ]);
}

main();
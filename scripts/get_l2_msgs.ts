import { createAztecNodeClient, Fr } from "@aztec/aztec.js";
import { TxEffect, TxHash } from "@aztec/stdlib/tx";
import fs from 'fs';

const L2_NODE_URL = "https://aztec-alpha-testnet-fullnode.zkv.xyz";

async function main() {
  console.log("Starting L2 message retrieval script...");
  console.log(`Connecting to L2 node at ${L2_NODE_URL}`);

  const l2Node = createAztecNodeClient(L2_NODE_URL);

  const latestBlock = await l2Node.getBlockNumber();
  console.log(`Latest block number: ${latestBlock}`);
  console.log(`Scanning blocks from ${latestBlock - 1000} to ${latestBlock}`);

  let txs: {blockNumber: number, l2toL1Msgs: Fr[], txHash: TxHash}[] = [];
  let processedBlocks = 0;
  let totalBlocks = 1001; // latestBlock - (latestBlock - 1000) + 1

  for (let i =32885; i <= 32990; i++) {
    const block = await l2Node.getBlock(i);
    console.log(`Processing block ${i}`);
    if (block) {
      const blockTxs = block.body.txEffects.filter(txEffect => txEffect.l2ToL1Msgs.length > 0);
      blockTxs.forEach(txEffect => {
        let data = {
          blockNumber: i,
          l2toL1Msgs: txEffect.l2ToL1Msgs,
          txHash: txEffect.txHash,
        }
        txs.push(data);
        // Append the new transaction data to tx.json
        try {
          // Read existing data if file exists, or initialize empty array
          const existingData = fs.existsSync('tx.json') ? JSON.parse(fs.readFileSync('tx.json', 'utf8')) : [];
          existingData.push(data);
          // Write updated data back to file
          fs.writeFileSync('tx.json', JSON.stringify(existingData, null, 2));
        } catch (err) {
          console.error('Error writing to tx.json:', err);
        }
        console.log(`Found transaction with L2->L1 messages in block ${i}: ${txEffect.txHash.toString()}`);
      });
    }
    
    processedBlocks++;
    if (processedBlocks % 100 === 0) {
      console.log(`Progress: ${processedBlocks}/${totalBlocks} blocks processed (${Math.round(processedBlocks/totalBlocks * 100)}%)`);
    }
  }

  console.log("\nSummary:");
  console.log(`Total blocks processed: ${processedBlocks}`);
  console.log(`Total transactions with L2->L1 messages found: ${txs.length}`);
  console.log("\nTransaction hashes:");
  console.log(txs.map((tx) => tx.toString()));
}

async function getTxEffect(txHash: TxHash) {
  const l2Node = createAztecNodeClient(L2_NODE_URL);

  // for (const txHash of txHashes) {
  //   let txReceipt = await l2Node.getTxReceipt(TxHash.fromString(txHash));
  //   const blockNumber = txReceipt.blockNumber;
  //   const txEffect = await l2Node.getTxEffect(TxHash.fromString(txHash));
  //   const l2toL1Msgs = txEffect?;
  //   console.log(txEffect);
  // }
  // return txEffect;
}

main().catch(console.error);
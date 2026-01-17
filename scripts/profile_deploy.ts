import { PodRacingContract } from "../src/artifacts/PodRacing.js"
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { setupWallet } from "../src/utils/setup_wallet.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";

async function main() {

    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    const wallet = await setupWallet();

    const sponsoredFPC = await getSponsoredFPCInstance();
    await wallet.registerContract(sponsoredFPC, SponsoredFPCContract.artifact);

    let accountManager = await deploySchnorrAccount(wallet);
    const address = accountManager.address;

    const profileTx = await PodRacingContract.deploy(wallet, address).profile({ profileMode: "full", from: address });
    console.dir(profileTx, { depth: 2 });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });

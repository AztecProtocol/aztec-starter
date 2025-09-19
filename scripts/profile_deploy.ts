import { PrivateVotingContract } from "../src/artifacts/PrivateVoting.js"
import { createLogger, PXE, Logger, SponsoredFeePaymentMethod, Fr } from "@aztec/aztec.js";
import { setupPXE } from "../src/utils/setup_pxe.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";

async function main() {

    let pxe: PXE;
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupPXE();

    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });

    let accountManager = await deploySchnorrAccount(pxe);
    const wallet = await accountManager.getWallet();
    const address = await accountManager.getAddress();

    const profileTx = await PrivateVotingContract.deploy(wallet, address).profile({ profileMode: "full", from: address });
    console.dir(profileTx, { depth: 2 });
}

main();

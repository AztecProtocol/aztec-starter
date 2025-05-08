import { AccountWallet, CompleteAddress, createLogger, Fr, PXE, waitForPXE, createPXEClient, Logger, AccountWalletWithSecretKey, AccountManager } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
import { setupPXE } from "./setup_pxe.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

export async function deploySchnorrAccount(pxe: PXE): Promise<AccountManager> {

    let logger: Logger;
    logger = createLogger('aztec:aztec-starter');

    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    let tx = await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait();
    let wallet = await schnorrAccount.getWallet();

    logger.info(`Schnorr account deployed at: ${wallet.getAddress()}`);

    return schnorrAccount;
}
import { createLogger, Fr, AccountManager } from "@aztec/aztec.js";
import type { PXE, Logger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getSponsoredFPCInstance } from "./sponsored_fpc.js";
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
    await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait();
    let wallet = await schnorrAccount.getWallet();

    logger.info(`Schnorr account deployed at: ${wallet.getAddress()}`);

    return schnorrAccount;
}
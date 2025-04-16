import { AccountWallet, CompleteAddress, createLogger, Fr, PXE, waitForPXE, createPXEClient, Logger, getWallet, AccountWalletWithSecretKey } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";

const setupPXE = async () => {
    const { PXE_URL = 'http://localhost:8081' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

export async function deploySchnorrAccount(): Promise<AccountWalletWithSecretKey> {

    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupPXE();

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    let wallet = await schnorrAccount.getWallet();

    const sponseredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({instance: sponseredFPC, artifact: SponsoredFPCContract.artifact});
    const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPC.address);

    let tx = await schnorrAccount.deploy({ fee: { paymentMethod } }).wait();

    logger.info(`Schnorr account deployed at: ${wallet.getAddress()}`);

    return wallet;
}

deploySchnorrAccount();

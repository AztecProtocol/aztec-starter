import { AccountWallet, CompleteAddress, createLogger, Fr, PXE, waitForPXE, createPXEClient, Logger } from "@aztec/aztec.js";
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getDeployedSponsoredFPCAddress } from "../src/utils/sponsored_fpc.js";

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

async function main() {

    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupSandbox();
    wallets = await getInitialTestAccountsWallets(pxe);
    const deployedSponseredFPC = await getDeployedSponsoredFPCAddress(pxe);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(deployedSponseredFPC);

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    let tx = await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait();
    let wallet = await schnorrAccount.getWallet();

    logger.info(`Schnorr account deployed at: ${wallet.getAddress()}`);
}

main();

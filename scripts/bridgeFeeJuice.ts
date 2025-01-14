import { AccountWallet, CompleteAddress, createLogger, L1FeeJuicePortalManager, PXE, waitForPXE, createPXEClient, Logger } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
    createPublicClient,
    createWalletClient,
    getContract,
    http,
} from 'viem';
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts';

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const MNEMONIC = 'test test test test test test test test test test test junk';

let walletClient = getL1WalletClient(foundry.rpcUrls.default.http[0], 0);
const ownerEthAddress = walletClient.account.address;

const publicClient = createPublicClient({
    chain: foundry,
    transport: http("http://127.0.0.1:8545"),
});

async function main() {

    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: Logger;

    const amount = 100n;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupSandbox();
    wallets = await getInitialTestAccountsWallets(pxe);
    const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses;

    const feeJuiceReceipient = wallets[0].getAddress()

    const feeJuicePortalManager = new L1FeeJuicePortalManager(
        l1ContractAddresses.feeJuicePortalAddress,
        l1ContractAddresses.feeJuiceAddress,
        publicClient,
        walletClient,
        logger,
    );

    let feeJuiceTokenManager = feeJuicePortalManager.getTokenManager()
    await feeJuicePortalManager.bridgeTokensPublic(feeJuiceReceipient, amount, true);

    logger.info(`Fee Juice minted to ${feeJuiceReceipient} on L2.`)
}

main();

// from here: https://github.com/AztecProtocol/aztec-packages/blob/ecbd59e58006533c8885a8b2fadbd9507489300c/yarn-project/end-to-end/src/fixtures/utils.ts#L534
function getL1WalletClient(rpcUrl: string, index: number) {
    const hdAccount = mnemonicToAccount(MNEMONIC, { addressIndex: index });
    return createWalletClient({
        account: hdAccount,
        chain: foundry,
        transport: http(rpcUrl),
    });
}
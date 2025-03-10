import { createLogger, L1FeeJuicePortalManager, PXE, waitForPXE, createPXEClient, Logger, AztecAddress } from "@aztec/aztec.js";
import {
    createPublicClient,
    createWalletClient,
    getContract,
    http,
} from 'viem';
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts';

const MNEMONIC = 'test test test test test test test test test test test junk';

let walletClient = getL1WalletClient(foundry.rpcUrls.default.http[0], 0);
const ownerEthAddress = walletClient.account.address;

const publicClient = createPublicClient({
    chain: foundry,
    transport: http("http://127.0.0.1:8545"),
});

export async function bridgeFeeJuice(pxe: PXE, recipient: AztecAddress, amount: bigint) {

    let logger = createLogger('aztec:aztec-starter');

    const l1ContractAddresses = (await pxe.getNodeInfo()).l1ContractAddresses;

    const feeJuicePortalManager = new L1FeeJuicePortalManager(
        l1ContractAddresses.feeJuicePortalAddress,
        l1ContractAddresses.feeJuiceAddress,
        // @ts-ignore
        publicClient,
        walletClient,
        logger,
    );

    let feeJuiceTokenManager = feeJuicePortalManager.getTokenManager()
    await feeJuicePortalManager.bridgeTokensPublic(recipient, amount, true);

    logger.info(`Fee Juice minted to ${recipient} on L2.`)
}


// from here: https://github.com/AztecProtocol/aztec-packages/blob/ecbd59e58006533c8885a8b2fadbd9507489300c/yarn-project/end-to-end/src/fixtures/utils.ts#L534
function getL1WalletClient(rpcUrl: string, index: number) {
    const hdAccount = mnemonicToAccount(MNEMONIC, { addressIndex: index });
    return createWalletClient({
        account: hdAccount,
        chain: foundry,
        transport: http(rpcUrl),
    });
}
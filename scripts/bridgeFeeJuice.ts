import { AccountWallet, CompleteAddress, createLogger, FeeJuicePaymentMethodWithClaim, Fr, L1FeeJuicePortalManager, PXE, waitForPXE, createPXEClient, Logger, FeeJuicePaymentMethod, PrivateFeePaymentMethod } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import {
    createPublicClient,
    createWalletClient,
    http,
} from 'viem';
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { deriveSigningKey } from '@aztec/stdlib/keys';
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts';
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { FPCContract } from "@aztec/noir-contracts.js/FPC";
import { EasyPrivateVotingContract } from "../src/artifacts/EasyPrivateVoting.js"
import { TokenContract } from "@aztec/noir-contracts.js/Token";

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const MNEMONIC = 'test test test test test test test test test test test junk';
const FEE_FUNDING_FOR_TESTER_ACCOUNT = BigInt(1_000e18);

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

    const amount = 100_000_000_000_000_000n;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupSandbox();
    wallets = await getInitialTestAccountsWallets(pxe);
    const nodeInfo = (await pxe.getNodeInfo())
    const l1ContractAddresses = nodeInfo.l1ContractAddresses;

    // Setup Schnorr AccountManager
    let secretKey = Fr.random();
    let salt = Fr.random();
    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    
    const newWallet = await schnorrAccount.getWallet()
    const feeJuiceReceipient = schnorrAccount.getAddress()

    const feeJuicePortalManager = new L1FeeJuicePortalManager(
        l1ContractAddresses.feeJuicePortalAddress,
        l1ContractAddresses.feeJuiceAddress,
        //@ts-ignore
        publicClient,
        walletClient,
        logger,
    );

    let feeJuiceTokenManager = feeJuicePortalManager.getTokenManager()
    const claim = await feeJuicePortalManager.bridgeTokensPublic(feeJuiceReceipient, amount, true);

    const feeJuice = await FeeJuiceContract.at(nodeInfo.protocolContractAddresses.feeJuice, wallets[0])
    const balance = await feeJuice.methods.balance_of_public(feeJuiceReceipient).simulate()
    logger.info(`${balance} Fee Juice minted to ${feeJuiceReceipient} on L2.`)

    // Two arbitraty txs to make the message available
    const votingContract = await EasyPrivateVotingContract.deploy(wallets[0], wallets[0].getAddress()).send().deployed();
    const bananaCoin = await TokenContract.deploy(wallets[0], wallets[0].getAddress(), "bananaCoin", "BNC", 18).send().deployed()

    // Claim funds and pay for a transaction flow

    const claimAndPay = new FeeJuicePaymentMethodWithClaim(newWallet, claim)
    await schnorrAccount.deploy({ fee: { paymentMethod: claimAndPay } }).wait()
    logger.info(`New account at ${newWallet.getAddress()} deployed with claimed funds.`)

    // Create a new voting contract instance, interacting from the newWallet
    const useFeeJuice = new FeeJuicePaymentMethod(feeJuiceReceipient)
    // vote for wallets[0]
    await votingContract.withWallet(newWallet).methods.cast_vote(wallets[0].getAddress()).send({ fee: { paymentMethod: useFeeJuice }}).wait()
    logger.info(`Vote cast from new account.`)

    // Private Fee Payments

    // Must use a Fee Paying Contract (FPC) to pay fees privately
    // Need to deploy an FPC to use Private Fee payment methods

    // This uses bananaCoin as the fee paying asset that will be exchanged for fee juice
    const fpc = await FPCContract.deploy(wallets[0], bananaCoin.address, wallets[0].getAddress()).send().deployed()

    // need to mint some bananaCoin and send to the newWallet
    await bananaCoin.methods.mint_to_private(wallets[0].getAddress(), newWallet.getAddress(), FEE_FUNDING_FOR_TESTER_ACCOUNT).send().wait()
    const bananaBalance = await bananaCoin.withWallet(newWallet).methods.balance_of_private(newWallet.getAddress()).simulate()

    logger.info(`BananaCoin balance of newWallet is ${bananaBalance}`)

    const privateFee = new PrivateFeePaymentMethod(fpc.address, newWallet)
    await votingContract.withWallet(newWallet).methods.cast_vote(wallets[0].getAddress()).send({ fee: { paymentMethod: privateFee }}).wait()

    // Sponsored Fee Payment
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
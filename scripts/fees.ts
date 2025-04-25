import { createLogger, FeeJuicePaymentMethodWithClaim, Fr, L1FeeJuicePortalManager, PXE, waitForPXE , createPXEClient, Logger, FeeJuicePaymentMethod, PrivateFeePaymentMethod, PublicFeePaymentMethod } from "@aztec/aztec.js";
import {
    Chain,
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
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { getDeployedSponsoredFPCAddress } from "../src/utils/sponsored_fpc.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { deploySchnorrAccount } from "./deploy-account.js";
import { getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import * as dotenv from 'dotenv';
dotenv.config();

const setupPXE = async () => {
    const { PXE_URL = 'http://localhost:8081' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const MNEMONIC = 'test test test test test test test test test test test junk';
const FEE_FUNDING_FOR_TESTER_ACCOUNT = 1000000000000000000n;

let walletClient = getL1WalletClient(process.env.L1_URL!, 0);

const publicClient = createPublicClient({
    chain: foundry,
    transport: http(process.env.L1_URL),
});

async function main() {

    let pxe: PXE;
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupPXE();
    const nodeInfo = (await pxe.getNodeInfo())

    // Setup Schnorr AccountManager

    let secretKey = Fr.random();
    let salt = Fr.random();
    let schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);
    
    const wallet1 = await (await deploySchnorrAccount()).getWallet()
    const newWallet = await schnorrAccount.getWallet()
    const feeJuiceReceipient = schnorrAccount.getAddress()

    // Setup and bridge fee asset to L2 to get fee juice

    const feeJuicePortalManager = await L1FeeJuicePortalManager.new(
        pxe,
        //@ts-ignore
        publicClient,
        walletClient,
        logger,
    );

    const claim = await feeJuicePortalManager.bridgeTokensPublic(feeJuiceReceipient, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);

    logger.info(`Fee Juice minted to ${feeJuiceReceipient} on L2.`)

    // set up sponsored fee payments
    const sponseredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({instance: sponseredFPC, artifact: SponsoredFPCContract.artifact});
    const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPC.address);
    // Two arbitraty txs to make the L1 message available on L2
    const votingContract = await EasyPrivateVotingContract.deploy(wallet1, wallet1.getAddress()).send({fee: {paymentMethod}}).deployed({timeout: 120000});
    const bananaCoin = await TokenContract.deploy(wallet1, wallet1.getAddress(), "bananaCoin", "BNC", 18).send({fee: {paymentMethod}}).deployed({timeout: 120000})

    // Claim Fee Juice & Pay Fees yourself

    const claimAndPay = new FeeJuicePaymentMethodWithClaim(newWallet, claim)
    await schnorrAccount.deploy({ fee: { paymentMethod: claimAndPay } }).wait({timeout: 120000})
    logger.info(`New account at ${newWallet.getAddress()} deployed using claimed funds for fees.`)

    // Pay fees yourself

    // Create a new voting contract instance, interacting from the newWallet
    const useFeeJuice = new FeeJuicePaymentMethod(newWallet.getAddress())
    await votingContract.withWallet(newWallet).methods.cast_vote(wallet1.getAddress()).send({ fee: { paymentMethod: useFeeJuice }}).wait({timeout: 120000})
    logger.info(`Vote cast from new account, paying fees via newWallet.`)

    // Private Fee Payments via FPC

    // Must use a Fee Paying Contract (FPC) to pay fees privately
    // Need to deploy an FPC to use Private Fee payment methods

    // This uses bananaCoin as the fee paying asset that will be exchanged for fee juice
    const fpc = await FPCContract.deploy(wallet1, bananaCoin.address, wallet1.getAddress()).send({fee: {paymentMethod}}).deployed({timeout: 120000})
    const fpcClaim = await feeJuicePortalManager.bridgeTokensPublic(fpc.address, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);
    // 2 public txs to make the bridged fee juice available
    // Mint some bananaCoin and send to the newWallet to pay fees privately
    await bananaCoin.methods.mint_to_private(wallet1.getAddress(), newWallet.getAddress(), FEE_FUNDING_FOR_TESTER_ACCOUNT).send({fee: {paymentMethod}}).wait({timeout: 120000})
    // mint some public bananaCoin to the newWallet to pay fees publicly
    await bananaCoin.methods.mint_to_public(newWallet.getAddress(), FEE_FUNDING_FOR_TESTER_ACCOUNT).send({fee: {paymentMethod}}).wait({timeout: 120000})
    const bananaBalance = await bananaCoin.withWallet(newWallet).methods.balance_of_private(newWallet.getAddress()).simulate()

    logger.info(`BananaCoin balance of newWallet is ${bananaBalance}`)

    const feeJuiceInstance = await getCanonicalFeeJuice();
    // await pxe.registerContract({instance: feeJuiceInstance.instance, artifact: })
    const feeJuice = await FeeJuiceContract.at(feeJuiceInstance.address, newWallet)
    await feeJuice.methods.claim(fpc.address, fpcClaim.claimAmount, fpcClaim.claimSecret, fpcClaim.messageLeafIndex).send().wait({timeout: 120000})

    logger.info(`Fpc fee juice balance ${await feeJuice.methods.balance_of_public(fpc.address).simulate()}`)

    const privateFee = new PrivateFeePaymentMethod(fpc.address, newWallet)    
    await bananaCoin.withWallet(newWallet).methods.transfer_in_private(newWallet.getAddress(), wallet1.getAddress(), 10, 0).send({ fee: { paymentMethod: privateFee }}).wait({timeout: 120000})
    
    logger.info(`Transfer paid with fees via the FPC, privately.`)

    // Public Fee Payments via FPC

    const publicFee = new PublicFeePaymentMethod(fpc.address, newWallet)
    await bananaCoin.withWallet(newWallet).methods.transfer_in_private(newWallet.getAddress(), wallet1.getAddress(), 10, 0).send({ fee: { paymentMethod: publicFee }}).wait({timeout: 120000})
    logger.info(`Transfer paid with fees via the FPC, publicly.`)

    // Sponsored Fee Payment

    // This method will only work in environments where there is a sponsored fee contract deployed 
    const deployedSponseredFPC = await getDeployedSponsoredFPCAddress(pxe);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(deployedSponseredFPC);
    await bananaCoin.withWallet(newWallet).methods.transfer_in_private(newWallet.getAddress(), wallet1.getAddress(), 10, 0).send({ fee: { paymentMethod: sponsoredPaymentMethod }}).wait({timeout: 120000})
    logger.info(`Transfer paid with fees from Sponsored FPC.`)
}

main();

// from here: https://github.com/AztecProtocol/aztec-packages/blob/ecbd59e58006533c8885a8b2fadbd9507489300c/yarn-project/end-to-end/src/fixtures/utils.ts#L534
function getL1WalletClient(rpcUrl: string, index: number) {
    const hdAccount = mnemonicToAccount(MNEMONIC, { addressIndex: index });
    const chain: Chain = {
        id: Number(process.env.L1_CHAIN_ID!),
        name: "test",
        nativeCurrency: {
            name: "ETH",
            symbol: "ETH",
            decimals: 18
        },
        rpcUrls: {default: {http: [process.env.L1_URL!]}}
    }
    return createWalletClient({
        account: hdAccount,
        chain,
        transport: http(rpcUrl),
    });
}
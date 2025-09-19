import {
    createWalletClient,
    http,
} from 'viem';
import { foundry } from 'viem/chains'
import { mnemonicToAccount } from 'viem/accounts';
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { FPCContract } from "@aztec/noir-contracts.js/FPC";
import { PrivateVotingContract } from "../src/artifacts/PrivateVoting.js"
import { TokenContract } from "@aztec/noir-contracts.js/Token";
// TODO: replace with import from aztec.js when published
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { getDeployedSponsoredFPCAddress, getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { createEthereumChain, createExtendedL1Client } from "@aztec/ethereum";
import { deploySchnorrAccount } from "../src/utils/deploy_account.js";
import { setupPXE } from "../src/utils/setup_pxe.js";
import { createLogger, FeeJuicePaymentMethod, FeeJuicePaymentMethodWithClaim, Fq, Fr, L1FeeJuicePortalManager, Logger, PrivateFeePaymentMethod, PublicFeePaymentMethod, PXE } from '@aztec/aztec.js';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import { getSchnorrAccount } from '@aztec/accounts/schnorr';

const MNEMONIC = 'test test test test test test test test test test test junk';
const FEE_FUNDING_FOR_TESTER_ACCOUNT = 1000000000000000000000n;

async function main() {

    let pxe: PXE;
    let logger: Logger;

    logger = createLogger('aztec:aztec-starter');

    pxe = await setupPXE();
    // wallets = await getInitialTestAccountsWallets(pxe);
    const nodeInfo = (await pxe.getNodeInfo())

    const chain = createEthereumChain(['http://localhost:8545'], nodeInfo.l1ChainId);
    const l1Client = createExtendedL1Client(chain.rpcUrls, MNEMONIC, chain.chainInfo);

    // Setup Schnorr AccountManager

    const account1 = await deploySchnorrAccount(pxe);
    const wallet1 = await account1.getWallet();

    let secretKey = Fr.random();
    let signingKey = Fq.random();
    let salt = Fr.random();
    let account2 = await getSchnorrAccount(pxe, secretKey, signingKey, salt);
    const wallet2 = await account2.getWallet();
    const feeJuiceRecipient = account2.getAddress();

    // Setup and bridge fee asset to L2 to get fee juice

    const feeJuicePortalManager = await L1FeeJuicePortalManager.new(
        pxe,
        //@ts-ignore
        l1Client,
        logger,
    );

    const claim = await feeJuicePortalManager.bridgeTokensPublic(feeJuiceRecipient, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);

    logger.info(`Fee Juice minted to ${feeJuiceRecipient} on L2.`)

    // set up sponsored fee payments
    const sponsoredFPC = await getSponsoredFPCInstance();
    await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
    const paymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

    // Two arbitrary txs to make the L1 message available on L2
    const votingContract = await PrivateVotingContract.deploy(wallet1, wallet1.getAddress()).send({
        from: wallet1.getAddress(),
        fee: { paymentMethod }
    }).deployed();
    const bananaCoin = await TokenContract.deploy(wallet1, wallet1.getAddress(), "bananaCoin", "BNC", 18).send({
        from: wallet1.getAddress(),
        fee: { paymentMethod }
    }).deployed()

    // Claim Fee Juice & Pay Fees yourself

    const claimAndPay = new FeeJuicePaymentMethodWithClaim(wallet2, claim)
    await account2.deploy({ fee: { paymentMethod: claimAndPay } }).wait()
    logger.info(`New account at ${account2.getAddress()} deployed using claimed funds for fees.`)

    // Pay fees yourself

    // Create a new voting contract instance, interacting from the newWallet
    const useFeeJuice = new FeeJuicePaymentMethod(account2.getAddress())
    await votingContract.withWallet(wallet2).methods.cast_vote(wallet1.getAddress()).send({
        from: wallet2.getAddress(),
        fee: { paymentMethod: useFeeJuice }
    }).wait()
    logger.info(`Vote cast from new account, paying fees via newWallet.`)

    // Private Fee Payments via FPC

    // Must use a Fee Paying Contract (FPC) to pay fees privately
    // Need to deploy an FPC to use Private Fee payment methods

    // This uses bananaCoin as the fee paying asset that will be exchanged for fee juice
    const fpc = await FPCContract.deploy(wallet1, bananaCoin.address, wallet1.getAddress()).send({
        from: wallet1.getAddress(),
        fee: { paymentMethod }
    }).deployed()
    const fpcClaim = await feeJuicePortalManager.bridgeTokensPublic(fpc.address, FEE_FUNDING_FOR_TESTER_ACCOUNT, true);
    // 2 public txs to make the bridged fee juice available
    // Mint some bananaCoin and send to the newWallet to pay fees privately
    await bananaCoin.methods.mint_to_private(wallet2.getAddress(), FEE_FUNDING_FOR_TESTER_ACCOUNT).send({
        from: wallet1.getAddress(),
        fee: { paymentMethod }
    }).wait()
    // mint some public bananaCoin to the newWallet to pay fees publicly
    await bananaCoin.methods.mint_to_public(wallet2.getAddress(), FEE_FUNDING_FOR_TESTER_ACCOUNT).send({
        from: wallet1.getAddress(),
        fee: { paymentMethod }
    }).wait()
    const bananaBalance = await bananaCoin.withWallet(wallet2).methods.balance_of_private(wallet2.getAddress()).simulate({
        from: wallet2.getAddress()
    })

    logger.info(`BananaCoin balance of newWallet is ${bananaBalance}`)

    const feeJuiceInstance = await getCanonicalFeeJuice();
    const feeJuice = await FeeJuiceContract.at(feeJuiceInstance.address, wallet2)
    await feeJuice.methods.claim(fpc.address, fpcClaim.claimAmount, fpcClaim.claimSecret, fpcClaim.messageLeafIndex).send({ from: wallet2.getAddress() }).wait()

    logger.info(`Fpc fee juice balance ${await feeJuice.methods.balance_of_public(fpc.address).simulate({
        from: wallet2.getAddress()
    })}`)

    const privateFee = new PrivateFeePaymentMethod(fpc.address, wallet2)
    await bananaCoin.withWallet(wallet2).methods.transfer_in_private(wallet2.getAddress(), wallet1.getAddress(), 10, 0).send({
        from: wallet2.getAddress(),
        fee: { paymentMethod: privateFee }
    }).wait()

    logger.info(`Transfer paid with fees via the FPC, privately.`)

    // Public Fee Payments via FPC

    const publicFee = new PublicFeePaymentMethod(fpc.address, wallet2)
    await bananaCoin.withWallet(wallet2).methods.transfer_in_private(wallet2.getAddress(), wallet1.getAddress(), 10, 0).send({
        from: wallet2.getAddress(),
        fee: { paymentMethod: publicFee }
    }).wait()
    logger.info(`Transfer paid with fees via the FPC, publicly.`)

    // Sponsored Fee Payment

    // This method will only work in environments where there is a sponsored fee contract deployed 
    const deployedSponsoredFPC = await getDeployedSponsoredFPCAddress(pxe);
    const sponsoredPaymentMethod = new SponsoredFeePaymentMethod(deployedSponsoredFPC);
    await bananaCoin.withWallet(wallet2).methods.transfer_in_private(wallet2.getAddress(), wallet1.getAddress(), 10, 0).send({
        from: wallet2.getAddress(),
        fee: { paymentMethod: sponsoredPaymentMethod }
    }).wait()
    logger.info(`Transfer paid with fees from Sponsored FPC.`)
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

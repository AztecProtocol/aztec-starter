import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountManager, AccountWallet, CompleteAddress, ContractDeployer, createLogger, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, Logger } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets, generateSchnorrAccounts } from "@aztec/accounts/testing"
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { spawn } from 'child_process';
import { SponsoredFeePaymentMethod } from './sponsored-fpc/sponsored_fee_payment_method.js';
import { L1TokenPortalManager, type L2AmountClaim, createAztecNodeClient, L1FeeJuicePortalManager, FeeJuicePaymentMethod, FeeJuicePaymentMethodWithClaim, AztecAddress } from "@aztec/aztec.js";
import { createPublicClient, createWalletClient, http, fallback } from 'viem';
import { foundry } from 'viem/chains';
import { createEthereumChain, createL1Clients } from '@aztec/ethereum';
import { retryUntil } from '@aztec/foundation/retry';

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("Accounts", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: Logger;
    let sandboxInstance;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;

    let randomAccountManagers: AccountManager[] = [];
    let randomWallets: AccountWallet[] = [];
    let randomAddresses: AztecAddress[] = [];

    let l1PortalManager: L1FeeJuicePortalManager;
    let fundedAddressClaims: L2AmountClaim[] = [];
    let feeJuiceAddress: AztecAddress;
    let skipSandbox: boolean;

    beforeAll(async () => {
        skipSandbox = false;
        if (!skipSandbox) {
            sandboxInstance = spawn("aztec", ["start", "--sandbox"], {
                detached: true,
                stdio: 'ignore'
            })
            await sleep(15000);
        }

        logger = createLogger('aztec:aztec-starter');
        logger.info("Aztec-Starter tests running.")

        pxe = await setupSandbox();

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress());
        sponsoredPaymentMethod = await SponsoredFeePaymentMethod.new(pxe);

        // generate random accounts
        randomAccountManagers = await Promise.all(
            (await generateSchnorrAccounts(5)).map(
                a => getSchnorrAccount(pxe, a.secret, a.signingKey, a.salt)
            )
        );
        // get corresponding wallets
        randomWallets = await Promise.all(randomAccountManagers.map(am => am.getWallet()));
        // get corresponding addresses
        randomAddresses = await Promise.all(randomWallets.map(async w => (await w.getCompleteAddress()).address));

        // create default ethereum clients
        const nodeInfo = await pxe.getNodeInfo();
        const chain = createEthereumChain(['http://localhost:8545'], nodeInfo.l1ChainId);
        const DefaultMnemonic = 'test test test test test test test test test test test junk';
        const { publicClient, walletClient } = createL1Clients(chain.rpcUrls, DefaultMnemonic, chain.chainInfo);

        feeJuiceAddress = nodeInfo.protocolContractAddresses.feeJuice;

        // create portal manager
        l1PortalManager = await L1FeeJuicePortalManager.new(
            pxe,
            publicClient,
            walletClient,
            logger
        );

    })

    afterAll(async () => {
        if (!skipSandbox) {
            sandboxInstance!.kill('SIGINT');
        }
    })

    it("Creates accounts with fee juice", async () => {
        // bridge funds to unfunded random addresses
        const claimAmount = 10n ** 22n;

        let claims: L2AmountClaim[] = [];
        // bridge sequentially to avoid l1 txs (nonces) being processed out of order
        for (let i = 0; i < randomAddresses.length; i++) {
            claims.push(await l1PortalManager.bridgeTokensPublic(randomAddresses[i], claimAmount, true));
        }
        // arbitrary transactions to progress 2 blocks, and have fee juice on Aztec ready to claim
        await EasyPrivateVotingContract.deploy(wallets[0], accounts[0]).send().deployed(); // deploy contract with first funded wallet
        await EasyPrivateVotingContract.deploy(wallets[0], accounts[0]).send().deployed(); // deploy contract with first funded wallet

        // claim and pay to deploy random accounts
        let sentTxs = [];
        for (let i = 0; i < randomWallets.length; i++) {
            const paymentMethod = new FeeJuicePaymentMethodWithClaim(randomWallets[i], claims[i]);
            sentTxs.push(randomAccountManagers[i].deploy({ fee: { paymentMethod } }));
        }
        await Promise.all(sentTxs.map(stx => stx.wait()));

        // random accounts funded to make regular transactions
        for (let i = 0; i < randomWallets.length; i++) {
            await EasyPrivateVotingContract.deploy(randomWallets[i], randomAddresses[i])
                .send()
                .deployed()
                ;
        }

    });

    it("Deploys first unfunded account from first funded account", async () => {
        const tx_acc = await randomAccountManagers[0].deploy({ deployWallet: wallets[0] });
    });

    it("Sponsored contract deployment", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = EasyPrivateVotingContractArtifact
        // const [deployerWallet, adminWallet] = wallets; // using first account as deployer and second as contract admin
        const accounts = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await getSchnorrAccount(pxe, a.secret, a.signingKey, a.salt)
            )
        );
        await Promise.all(accounts.map(a => a.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } })));
        const daWallets = await Promise.all(accounts.map(a => a.getWallet()));
        const [deployerWallet, adminWallet] = daWallets;
        const [deployerAddress, adminAddress] = daWallets.map(w => w.getAddress());
        // const adminAddress = adminWallet.getCompleteAddress().address;

        const deploymentData = await getContractInstanceFromDeployParams(VotingContractArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerWallet.getAddress()
            });
        const deployer = new ContractDeployer(VotingContractArtifact, deployerWallet);
        const tx = deployer.deploy(adminAddress).send({
            contractAddressSalt: salt,
            fee: { paymentMethod: sponsoredPaymentMethod } // without the sponsoredFPC the deployment fails, thus confirming it works
        })
        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
                error: ''
            }),
        );

        const receiptAfterMined = await tx.wait({ wallet: deployerWallet });
        expect(await pxe.getContractMetadata(deploymentData.address)).toBeDefined();
        expect((await pxe.getContractMetadata(deploymentData.address)).contractInstance).toBeTruthy();
        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        expect(receiptAfterMined.contract.instance.address).toEqual(deploymentData.address)
    })

});
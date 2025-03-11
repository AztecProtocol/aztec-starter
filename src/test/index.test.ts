import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountManager, AccountWallet, CompleteAddress, ContractDeployer, createLogger, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, Logger } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets, generateSchnorrAccounts } from "@aztec/accounts/testing"
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { spawn } from 'child_process';
import { SponsoredFeePaymentMethod } from './sponsored_fee_payment_method.js';
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

describe("Voting", () => {
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

    beforeAll(async () => {
        // sandboxInstance = spawn("aztec", ["start", "--sandbox"], {
        //     detached: true,
        //     stdio: 'ignore'
        // })
        // sleep(15000)
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
            walletClient, //getL1WalletClient(foundry.rpcUrls.default.http[0], 0),
            logger
        );



        // fundedAddressClaims = await Promise.all(randomAddresses.map(ra =>
        //     l1PortalManager.bridgeTokensPublic(ra, 10n ** 22n, true)
        // ));

        // // skip 2 blocks for bridging to complete
        // const aztecNode = await createAztecNodeClient("http://localhost:8080");
        // const initialBlockNumber = await aztecNode.getBlockNumber();
        // await aztecNode!.flushTxs();
        // await retryUntil(async () => (await aztecNode.getBlockNumber()) >= initialBlockNumber + 2);

    })

    // afterAll(async () => {
    //     sandboxInstance!.kill();
    // })

    it("Creates accounts with fee juice", async () => {
        // bridge funds
        const claimAmount = 10n ** 22n;
        const claim = await l1PortalManager.bridgeTokensPublic(randomAddresses[0], claimAmount, true);

        // arbitrary transactions to progress 2 blocks, and have fee juice on Aztec ready to claim
        await randomAccountManagers[2].deploy({ deployWallet: wallets[0] }).wait(); // deploy third unfunded account with first funded wallet
        await EasyPrivateVotingContract.deploy(wallets[0], accounts[0]).send().deployed(); // deploy contract with first funded wallet

        // claim and pay to deploy first unfunded account
        const paymentMethod = new FeeJuicePaymentMethodWithClaim(randomWallets[0], claim);
        const tx_acc = await randomAccountManagers[0].deploy({ fee: { paymentMethod } }).wait();

        // random account funded to make regular transactions
        await EasyPrivateVotingContract.deploy(randomWallets[0], randomAddresses[0])
            .send()
            .deployed()
            ;

    });

    it("Deploys first unfunded account from first funded account", async () => {
        const tx_acc = await randomAccountManagers[0].deploy({ deployWallet: wallets[0] });
    });

    it("Deploys the contract", async () => {
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
    }, 300_000)

    it("It casts a vote", async () => {
        const candidate = new Fr(1)

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        const tx = await contract.methods.cast_vote(candidate).send().wait();
        let count = await contract.methods.get_vote(candidate).simulate();
        expect(count).toBe(1n);
    }, 300_000)

    it("It should fail when trying to vote twice", async () => {
        const candidate = new Fr(1)

        const votingContract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        await votingContract.methods.cast_vote(candidate).send().wait();
        expect(await votingContract.methods.get_vote(candidate).simulate()).toBe(1n);

        // We try voting again, but our TX is dropped due to trying to emit duplicate nullifiers
        // first confirm that it fails simulation
        await expect(votingContract.methods.cast_vote(candidate).send().wait()).rejects.toThrow(/Nullifier collision/);
        // if we skip simulation before submitting the tx,
        // tx will be included in a block but with app logic reverted
        await expect(
            votingContract.methods.cast_vote(candidate).send({ skipPublicSimulation: true }).wait(),
        ).rejects.toThrow(TxStatus.APP_LOGIC_REVERTED);

    }, 300_000)

});
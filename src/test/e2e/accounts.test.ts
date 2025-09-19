import { PrivateVotingContractArtifact, PrivateVotingContract } from "../../artifacts/PrivateVoting.js"
import { AccountManager, AccountWallet, ContractDeployer, createLogger, Fr, PXE, TxStatus, getContractInstanceFromInstantiationParams, Logger, Fq } from "@aztec/aztec.js";
import { generateSchnorrAccounts } from "@aztec/accounts/testing"
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { spawn, spawnSync } from 'child_process';

import { SponsoredFeePaymentMethod } from "@aztec/aztec.js/fee/testing";
import { getFeeJuiceBalance, type L2AmountClaim, L1FeeJuicePortalManager, FeeJuicePaymentMethodWithClaim, AztecAddress } from "@aztec/aztec.js";
import { createEthereumChain, createExtendedL1Client } from '@aztec/ethereum';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupPXE } from "../../utils/setup_pxe.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { sign } from "crypto";

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("Accounts", () => {
    let pxe: PXE;
    let logger: Logger;
    let sandboxInstance;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let ownerWallet: AccountWallet;

    let randomAccountManagers: AccountManager[] = [];
    let randomWallets: AccountWallet[] = [];
    let randomAddresses: AztecAddress[] = [];

    let l1PortalManager: L1FeeJuicePortalManager;
    let feeJuiceAddress: AztecAddress;
    let skipSandbox: boolean;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:accounts');
        logger.info("Aztec-Starter tests running.")

        skipSandbox = process.env.SKIP_SANDBOX === 'true';
        const aztecBinary = process.env.AZTEC_BIN ?? 'aztec';
        if (!skipSandbox) {
            const { error } = spawnSync(aztecBinary, ['--version'], { stdio: 'ignore' });
            if (error) {
                logger.warn(`Skipping sandbox startup because ${aztecBinary} is not available: ${error.message}`);
                skipSandbox = true;
            }
        }

        if (!skipSandbox) {
            sandboxInstance = spawn(aztecBinary, ["start", "--sandbox"], {
                detached: true,
                stdio: 'ignore'
            })
            await sleep(15000);
        }

        pxe = await setupPXE('accounts');

        const sponsoredFPC = await getSponsoredFPCInstance();
        await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // create default ethereum clients
        const nodeInfo = await pxe.getNodeInfo();
        const chain = createEthereumChain(['http://localhost:8545'], nodeInfo.l1ChainId);
        const DefaultMnemonic = 'test test test test test test test test test test test junk';
        const l1Client = createExtendedL1Client(chain.rpcUrls, DefaultMnemonic, chain.chainInfo);

        feeJuiceAddress = nodeInfo.protocolContractAddresses.feeJuice;

        // create portal manager
        l1PortalManager = await L1FeeJuicePortalManager.new(
            pxe,
            l1Client,
            logger
        );

        let secretKey = Fr.random();
        let signingKey = Fq.random();
        let salt = Fr.random();
        let schnorrAccount = await getSchnorrAccount(pxe, secretKey, signingKey, salt)
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait();
        ownerWallet = await schnorrAccount.getWallet();
    })

    beforeEach(async () => {
        // generate random accounts
        randomAccountManagers = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                a => getSchnorrAccount(pxe, a.secret, a.signingKey, a.salt)
            )
        );
        // get corresponding wallets
        randomWallets = await Promise.all(randomAccountManagers.map(am => am.getWallet()));
        // get corresponding addresses
        randomAddresses = await Promise.all(randomWallets.map(async w => (await w.getCompleteAddress()).address));
    })

    afterAll(async () => {
        if (!skipSandbox) {
            sandboxInstance!.kill('SIGINT');
        }
    })

    it("Creates accounts with fee juice", async () => {
        // balance of each random account is 0 before bridge
        let balances = await Promise.all(randomAddresses.map(async a => getFeeJuiceBalance(a, pxe)));
        balances.forEach(b => expect(b).toBe(0n));


        // bridge funds to unfunded random addresses
        const claimAmount = await l1PortalManager.getTokenManager().getMintAmount();
        const approxMaxDeployCost = 10n ** 10n; // Need to manually update this if fees increase significantly
        let claims: L2AmountClaim[] = [];
        // bridge sequentially to avoid l1 txs (nonces) being processed out of order
        for (let i = 0; i < randomAddresses.length; i++) {
            claims.push(await l1PortalManager.bridgeTokensPublic(randomAddresses[i], claimAmount, true));
        }

        // arbitrary transactions to progress 2 blocks, and have fee juice on Aztec ready to claim
        await PrivateVotingContract.deploy(ownerWallet, ownerWallet.getAddress()).send({
            from: ownerWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed(); // deploy contract with first funded wallet
        await PrivateVotingContract.deploy(ownerWallet, ownerWallet.getAddress()).send({
            from: ownerWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed(); // deploy contract with first funded wallet

        // claim and pay to deploy random accounts
        let sentTxs = [];
        for (let i = 0; i < randomWallets.length; i++) {
            const paymentMethod = new FeeJuicePaymentMethodWithClaim(randomWallets[i], claims[i]);
            await randomAccountManagers[i].deploy({ fee: { paymentMethod } }).wait();
        }
        // balance after deploy with claimed fee juice
        balances = await Promise.all(randomAddresses.map(async a => await getFeeJuiceBalance(a, pxe)));
        const amountAfterDeploy = claimAmount - approxMaxDeployCost;
        balances.forEach(b => expect(b).toBeGreaterThanOrEqual(amountAfterDeploy));

    });

    it("Deploys first unfunded account from first funded account", async () => {
        const receipt = await randomAccountManagers[0]
            .deploy({ fee: { paymentMethod: sponsoredPaymentMethod }, deployWallet: ownerWallet })
            .wait();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        const deployedWallet = await randomAccountManagers[0].getWallet();
        expect(deployedWallet.getAddress()).toEqual(randomAccountManagers[0].getAddress());
    });

    it("Sponsored contract deployment", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = PrivateVotingContractArtifact
        const accounts = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await getSchnorrAccount(pxe, a.secret, a.signingKey, a.salt)
            )
        );
        await Promise.all(accounts.map(a => a.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait()));
        const daWallets = await Promise.all(accounts.map(a => a.getWallet()));
        const [deployerWallet, adminWallet] = daWallets;
        const [deployerAddress, adminAddress] = daWallets.map(w => w.getAddress());

        const deploymentData = await getContractInstanceFromInstantiationParams(VotingContractArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerWallet.getAddress()
            });
        const deployer = new ContractDeployer(VotingContractArtifact, deployerWallet);
        const tx = deployer.deploy(adminAddress).send({
            from: deployerAddress,
            contractAddressSalt: salt,
            fee: { paymentMethod: sponsoredPaymentMethod } // without the sponsoredFPC the deployment fails, thus confirming it works
        })

        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
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

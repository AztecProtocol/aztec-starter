import { PodRacingContractArtifact, PodRacingContract } from "../../artifacts/PodRacing.js"
import { generateSchnorrAccounts } from "@aztec/accounts/testing"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { createEthereumChain, createExtendedL1Client } from '@aztec/ethereum';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { FeeJuiceContract } from "@aztec/noir-contracts.js/FeeJuice";
import { getAztecNodeUrl, getEnv, getL1RpcUrl, getTimeouts } from "../../../config/config.js";
import { TestWallet } from "@aztec/test-wallet/server";
import { AztecNode, createAztecNodeClient } from "@aztec/aztec.js/node";
import { L1FeeJuicePortalManager, L2AmountClaim } from "@aztec/aztec.js/ethereum";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { TxStatus } from "@aztec/stdlib/tx";
import { AccountManager } from "@aztec/aztec.js/wallet";
import { getCanonicalFeeJuice } from '@aztec/protocol-contracts/fee-juice';
import { FeeJuicePaymentMethodWithClaim, PrivateFeePaymentMethod, PublicFeePaymentMethod } from "@aztec/aztec.js/fee";

describe("Accounts", () => {
    let wallet: TestWallet;
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let ownerAccount: AccountManager;

    let randomAccountManagers: AccountManager[] = [];
    let randomAddresses: AztecAddress[] = [];

    let l1PortalManager: L1FeeJuicePortalManager;
    let feeJuiceAddress: AztecAddress;
    let feeJuiceContract: FeeJuiceContract;
    let node: AztecNode;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:accounts');
        logger.info(`Aztec-Starter tests running.`)
        const nodeUrl = getAztecNodeUrl();
        node = createAztecNodeClient(nodeUrl);
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // create default ethereum clients
        const nodeInfo = await node.getNodeInfo();
        const chain = createEthereumChain([getL1RpcUrl()], nodeInfo.l1ChainId);
        const DefaultMnemonic = 'test test test test test test test test test test test junk';
        const l1Client = createExtendedL1Client(chain.rpcUrls, DefaultMnemonic, chain.chainInfo);

        feeJuiceAddress = nodeInfo.protocolContractAddresses.feeJuice;

        // create portal manager
        l1PortalManager = await L1FeeJuicePortalManager.new(
            node,
            l1Client,
            logger
        );

        // Set up a wallet
        let secretKey = Fr.random();
        let signingKey = GrumpkinScalar.random();
        let salt = Fr.random();
        ownerAccount = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
        await (await ownerAccount.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });

        // Set up fee juice contract
        const feeJuiceInstance = await getCanonicalFeeJuice();
        feeJuiceContract = await FeeJuiceContract.at(feeJuiceInstance.address, wallet);
    }, 600000)

    beforeEach(async () => {
        // generate random accounts
        randomAccountManagers = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await wallet.createSchnorrAccount(a.secret, a.salt, a.signingKey)
            )
        );
        // get corresponding addresses
        randomAddresses = randomAccountManagers.map(am => am.address);
    })

    it("Creates accounts with fee juice", async () => {
        if (getEnv() === 'devnet') return;

        console.log('Starting "Creates accounts with fee juice" test');
        console.log(`Random addresses: ${randomAddresses.map(a => a.toString()).join(', ')}`);

        // balance of each random account is 0 before bridge
        console.log('Checking initial balances...');
        let balances = await Promise.all(randomAddresses.map(async a =>
            await feeJuiceContract.methods.balance_of_public(a).simulate({ from: ownerAccount.address })
        ));
        console.log(`Initial balances: ${balances.join(', ')}`);
        balances.forEach(b => expect(b).toBe(0n));

        // bridge funds to unfunded random addresses
        const claimAmount = await l1PortalManager.getTokenManager().getMintAmount();
        console.log(`Claim amount: ${claimAmount}`);
        let claims: L2AmountClaim[] = [];
        // bridge sequentially to avoid l1 txs(nonces) being processed out of order
        for (let i = 0; i < randomAddresses.length; i++) {
            console.log(`Bridging tokens for address ${i}: ${randomAddresses[i].toString()}`);
            const claim = await l1PortalManager.bridgeTokensPublic(randomAddresses[i], claimAmount, true);
            claims.push(claim);
        }
        console.log(`Total claims created: ${claims.length}`);

        // arbitrary transactions to progress 2 blocks, and have fee juice on Aztec ready to claim
        console.log('Deploying first PodRacingContract to progress blocks...');
        await PodRacingContract.deploy(wallet, ownerAccount.address).send({
            from: ownerAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout }); // deploy contract with first funded wallet
        console.log('First PodRacingContract deployed');

        console.log('Deploying second PodRacingContract to progress blocks...');
        await PodRacingContract.deploy(wallet, ownerAccount.address).send({
            from: ownerAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout }); // deploy contract with first funded wallet
        console.log('Second PodRacingContract deployed');

        // Now deploy random accounts using FeeJuicePaymentMethodWithClaim (which claims and pays in one tx)
        console.log('Starting account deployments with FeeJuicePaymentMethodWithClaim...');
        for (let i = 0; i < randomAccountManagers.length; i++) {
            const paymentMethod = new FeeJuicePaymentMethodWithClaim(randomAddresses[i], claims[i]);
            const deployTx = (await randomAccountManagers[i].getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod } });
            const receipt = await deployTx.wait({ timeout: getTimeouts().deployTimeout });
        }
    });

    it("Deploys first unfunded account from first funded account", async () => {
        const receipt = await (await randomAccountManagers[0].getDeployMethod())
            .send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } })
            .wait({ timeout: getTimeouts().deployTimeout });

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        const deployedAccount = await randomAccountManagers[0].getAccount();
        expect(deployedAccount.getAddress()).toEqual(randomAccountManagers[0].address);
    });

    it("Sponsored contract deployment", async () => {
        logger.info('Starting "Sponsored contract deployment" test');
        const salt = Fr.random();
        logger.info(`Using salt: ${salt.toString()}`);
        const PodRacingArtifact = PodRacingContractArtifact

        logger.info('Generating 2 Schnorr accounts...');
        const accounts = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await wallet.createSchnorrAccount(a.secret, a.salt, a.signingKey)
            )
        );
        logger.info(`Generated accounts: ${accounts.map(a => a.address.toString()).join(', ')}`);

        logger.info('Deploying accounts...');
        await Promise.all(accounts.map(async (a, i) => {
            logger.info(`Deploying account ${i}: ${a.address.toString()}`);
            return (await a.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });
        }));
        logger.info('All accounts deployed');

        const deployedAccounts = await Promise.all(accounts.map(a => a.getAccount()));
        const [deployerAccount, adminAccount] = deployedAccounts;
        const [deployerAddress, adminAddress] = deployedAccounts.map(w => w.getAddress());
        logger.info(`Deployer address: ${deployerAddress.toString()}`);
        logger.info(`Admin address: ${adminAddress.toString()}`);

        const deploymentData = await getContractInstanceFromInstantiationParams(PodRacingArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerAccount.getAddress()
            });
        const deployer = new ContractDeployer(PodRacingArtifact, wallet);
        const tx = deployer.deploy(adminAddress).send({
            from: deployerAddress,
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

        const receiptAfterMined = await tx.wait({ wallet, timeout: getTimeouts().deployTimeout });
        expect(await wallet.getContractMetadata(deploymentData.address)).toBeDefined();
        expect((await wallet.getContractMetadata(deploymentData.address)).contractInstance).toBeTruthy();
        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        expect(receiptAfterMined.contract.instance.address).toEqual(deploymentData.address)
    })

});

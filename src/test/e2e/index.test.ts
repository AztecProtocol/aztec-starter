import { PrivateVotingContractArtifact, PrivateVotingContract } from "../../artifacts/PrivateVoting.js"
import { generateSchnorrAccounts } from "@aztec/accounts/testing"
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { createEthereumChain, createExtendedL1Client } from '@aztec/ethereum';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupWallet } from "../../utils/setup_wallet.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getAztecNodeUrl, getL1RpcUrl, getTimeouts } from "../../../config/config.js";
import { TestWallet } from "@aztec/test-wallet/server";
import { createAztecNodeClient } from "@aztec/aztec.js/node";
import { L1FeeJuicePortalManager } from "@aztec/aztec.js/ethereum";
import { AztecAddress } from "@aztec/stdlib/aztec-address";
import { Logger, createLogger } from "@aztec/aztec.js/log";
import { ContractInstanceWithAddress } from "@aztec/stdlib/contract";
import { Fr, GrumpkinScalar } from "@aztec/aztec.js/fields";
import { getContractInstanceFromInstantiationParams } from "@aztec/stdlib/contract";
import { ContractDeployer } from "@aztec/aztec.js/deployment";
import { TxStatus } from "@aztec/stdlib/tx";
import { AccountManager } from "@aztec/aztec.js/wallet";

describe("Voting", () => {
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;
    let wallet: TestWallet;
    let firstAccount: AccountManager
    let l1PortalManager: L1FeeJuicePortalManager;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:voting');
        logger.info(`Aztec-Starter tests running.`)
        const nodeUrl = getAztecNodeUrl();
        const node = createAztecNodeClient(nodeUrl);
        wallet = await setupWallet();

        sponsoredFPC = await getSponsoredFPCInstance();
        await wallet.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // create default ethereum clients
        const nodeInfo = await node.getNodeInfo();
        const chain = createEthereumChain([getL1RpcUrl()], nodeInfo.l1ChainId);
        const DefaultMnemonic = 'test test test test test test test test test test test junk';
        const l1Client = createExtendedL1Client(chain.rpcUrls, DefaultMnemonic, chain.chainInfo);

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
        firstAccount = await wallet.createSchnorrAccount(secretKey, salt, signingKey);
        (await firstAccount.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });
        // firstWallet = await schnorrAccount.getWallet();
        const existingSenders = await wallet.getAddressBook();
        // wallet.get
        // await Promise.all(
        //     existingSenders
        //         .filter(sender => !sender.equals(schnorrAccount.address))
        //         .map(sender => pxe.removeSender(sender))
        // );
        await wallet.registerSender(firstAccount.address);
    }, 600000)

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = PrivateVotingContractArtifact
        const accounts = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await wallet.createSchnorrAccount(a.secret, a.salt, a.signingKey)
            )
        );
        await Promise.all(accounts.map(async (a) => (await a.getDeployMethod()).send({ from: AztecAddress.ZERO, fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout })));
        const deployedAccounts = await Promise.all(accounts.map(a => a.getAccount()));
        const [deployerAccount, adminAccount] = deployedAccounts
        const [deployerAddress, adminAddress] = deployedAccounts.map(w => w.getAddress());

        const deploymentData = await getContractInstanceFromInstantiationParams(VotingContractArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerAccount.getAddress()
            });
        const deployer = new ContractDeployer(VotingContractArtifact, wallet);
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
    }, 600000)

    it("It casts a vote", async () => {
        const candidate = new Fr(1)

        const contract = await PrivateVotingContract.deploy(wallet, firstAccount.address).send({
            from: firstAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });
        const tx = await contract.methods.cast_vote(candidate).send({
            from: firstAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });
        let count = await contract.methods.get_vote(candidate).simulate({
            from: firstAccount.address
        });
        expect(count).toBe(1n);
    }, 600000)

    it("It should fail when trying to vote twice", async () => {
        const candidate = new Fr(1)

        const votingContract = await PrivateVotingContract.deploy(wallet, firstAccount.address).send({
            from: firstAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });
        await votingContract.methods.cast_vote(candidate).send({
            from: firstAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });
        expect(await votingContract.methods.get_vote(candidate).simulate({
            from: firstAccount.address
        })).toBe(1n);

        // We try voting again, but our TX is dropped due to trying to emit duplicate nullifiers
        // first confirm that it fails simulation
        await expect(votingContract.methods.cast_vote(candidate).send({
            from: firstAccount.address,
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout })).rejects.toThrow(/Existing nullifier/);
        // if we skip simulation before submitting the tx,
        // tx will be included in a block but with app logic reverted
        await expect(
            votingContract.methods.cast_vote(candidate).send({
                from: firstAccount.address,
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout }),
        ).rejects.toThrow(/Existing nullifier/);

    }, 600000)

});

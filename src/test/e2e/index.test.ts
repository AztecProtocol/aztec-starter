import { PrivateVotingContractArtifact, PrivateVotingContract } from "../../artifacts/PrivateVoting.js"
import { AccountWallet, ContractDeployer, createLogger, Fr, PXE, TxStatus, getContractInstanceFromInstantiationParams, Logger, ContractInstanceWithAddress, Fq } from "@aztec/aztec.js";
import { generateSchnorrAccounts } from "@aztec/accounts/testing"
import { getSchnorrAccount } from '@aztec/accounts/schnorr';
import { spawn, spawnSync } from 'child_process';
import { SponsoredFeePaymentMethod } from '@aztec/aztec.js/fee/testing'
import { L1FeeJuicePortalManager, AztecAddress } from "@aztec/aztec.js";
import { createEthereumChain, createExtendedL1Client } from '@aztec/ethereum';
import { getSponsoredFPCInstance } from "../../utils/sponsored_fpc.js";
import { setupPXE } from "../../utils/setup_pxe.js";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";
import { getL1RpcUrl, getTimeouts } from "../../../config/config.js";

describe("Voting", () => {
    let pxe: PXE;
    let firstWallet: AccountWallet;
    let logger: Logger;
    let sponsoredFPC: ContractInstanceWithAddress;
    let sponsoredPaymentMethod: SponsoredFeePaymentMethod;

    let l1PortalManager: L1FeeJuicePortalManager;

    beforeAll(async () => {
        logger = createLogger('aztec:aztec-starter:voting');
        logger.info(`Aztec-Starter tests running.`)

        pxe = await setupPXE();

        sponsoredFPC = await getSponsoredFPCInstance();
        await pxe.registerContract({ instance: sponsoredFPC, artifact: SponsoredFPCContract.artifact });
        sponsoredPaymentMethod = new SponsoredFeePaymentMethod(sponsoredFPC.address);

        // create default ethereum clients
        const nodeInfo = await pxe.getNodeInfo();
        const chain = createEthereumChain([getL1RpcUrl()], nodeInfo.l1ChainId);
        const DefaultMnemonic = 'test test test test test test test test test test test junk';
        const l1Client = createExtendedL1Client(chain.rpcUrls, DefaultMnemonic, chain.chainInfo);

        // create portal manager
        l1PortalManager = await L1FeeJuicePortalManager.new(
            pxe,
            l1Client,
            logger
        );

        // Set up a wallet
        let secretKey = Fr.random();
        let signingKey = Fq.random();
        let salt = Fr.random();
        let schnorrAccount = await getSchnorrAccount(pxe, secretKey, signingKey, salt)
        await schnorrAccount.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout });
        firstWallet = await schnorrAccount.getWallet();
        const existingSenders = await pxe.getSenders();
        await Promise.all(
            existingSenders
                .filter(sender => !sender.equals(firstWallet.getAddress()))
                .map(sender => pxe.removeSender(sender))
        );
        await firstWallet.registerSender(firstWallet.getAddress());
    }, 600000)

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = PrivateVotingContractArtifact
        const accounts = await Promise.all(
            (await generateSchnorrAccounts(2)).map(
                async a => await getSchnorrAccount(pxe, a.secret, a.signingKey, a.salt)
            )
        );
        await Promise.all(accounts.map(a => a.deploy({ fee: { paymentMethod: sponsoredPaymentMethod } }).wait({ timeout: getTimeouts().deployTimeout })));
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
                error: ''
            }),
        );

        const receiptAfterMined = await tx.wait({ wallet: deployerWallet, timeout: getTimeouts().deployTimeout });
        expect(await pxe.getContractMetadata(deploymentData.address)).toBeDefined();
        expect((await pxe.getContractMetadata(deploymentData.address)).contractInstance).toBeTruthy();
        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        expect(receiptAfterMined.contract.instance.address).toEqual(deploymentData.address)
    }, 600000)

    it("It casts a vote", async () => {
        const candidate = new Fr(1)

        const contract = await PrivateVotingContract.deploy(firstWallet, firstWallet.getAddress()).send({
            from: firstWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });
        const tx = await contract.methods.cast_vote(candidate).send({
            from: firstWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });
        let count = await contract.methods.get_vote(candidate).simulate({
            from: firstWallet.getAddress()
        });
        expect(count).toBe(1n);
    }, 600000)

    it("It should fail when trying to vote twice", async () => {
        const candidate = new Fr(1)

        const votingContract = await PrivateVotingContract.deploy(firstWallet, firstWallet.getAddress()).send({
            from: firstWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).deployed({ timeout: getTimeouts().deployTimeout });
        await votingContract.methods.cast_vote(candidate).send({
            from: firstWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout });
        expect(await votingContract.methods.get_vote(candidate).simulate({
            from: firstWallet.getAddress()
        })).toBe(1n);

        // We try voting again, but our TX is dropped due to trying to emit duplicate nullifiers
        // first confirm that it fails simulation
        await expect(votingContract.methods.cast_vote(candidate).send({
            from: firstWallet.getAddress(),
            fee: { paymentMethod: sponsoredPaymentMethod }
        }).wait({ timeout: getTimeouts().txTimeout })).rejects.toThrow(/Existing nullifier/);
        // if we skip simulation before submitting the tx,
        // tx will be included in a block but with app logic reverted
        await expect(
            votingContract.methods.cast_vote(candidate).send({
                from: firstWallet.getAddress(),
                fee: { paymentMethod: sponsoredPaymentMethod }
            }).wait({ timeout: getTimeouts().txTimeout }),
        ).rejects.toThrow(/Existing nullifier/);

    }, 600000)

});

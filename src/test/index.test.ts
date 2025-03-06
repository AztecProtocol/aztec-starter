import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, ContractDeployer, createLogger, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, Logger } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing"
import { spawn } from 'child_process';

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

    beforeAll(async () => {
        sandboxInstance = spawn("aztec", ["start", "--sandbox"], {
            detached: true,
            stdio: 'ignore'
        })
        sleep(15000)
        logger = createLogger('aztec:aztec-starter');
        logger.info("Aztec-Starter tests running.")

        pxe = await setupSandbox();

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress())
    })

    afterAll(async () => {
        sandboxInstance!.kill();
    })

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = EasyPrivateVotingContractArtifact
        const [deployerWallet, adminWallet] = wallets; // using first account as deployer and second as contract admin
        const adminAddress = adminWallet.getCompleteAddress().address;

        const deploymentData = await getContractInstanceFromDeployParams(VotingContractArtifact,
            {
                constructorArgs: [adminAddress],
                salt,
                deployer: deployerWallet.getAddress()
            });
        const deployer = new ContractDeployer(VotingContractArtifact, deployerWallet);
        const tx = deployer.deploy(adminAddress).send({ contractAddressSalt: salt })
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

        await votingContract.methods.end_vote().send().wait()
        console.log("vote ended")
        const logFilter = { contractAddress: votingContract.address }
        let logs = await pxe.getPublicLogs(logFilter)
        console.log(logs)
    }, 300_000)

});
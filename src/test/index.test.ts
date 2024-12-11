import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, ContractDeployer, createDebugLogger, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, DebugLogger } from "@aztec/aztec.js";
import { deployInitialTestAccounts, getInitialTestAccountsWallets } from "@aztec/accounts/testing"

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    // TODO: implement reading the DelegationNote from an isolated PXE
    // 8080: cd ~/.aztec && docker-compose -f ./docker-compose.sandbox.yml up
    // 8081: aztec start --port 8081 --pxe --pxe.nodeUrl http://host.docker.internal:8080/
    // const DELEGATEE_PXE_URL = 'http://localhost:8081';

    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

describe("Voting", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];
    let logger: DebugLogger;

    beforeAll(async () => {
        logger = createDebugLogger('aztec:aztec-starter');
        logger.info("Aztec-Starter tests running.")

        pxe = await setupSandbox();
        // deployInitialTestAccounts(pxe); // NOTE: run at least once in sandbox to circumvent issue #9384

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress())
    })

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = EasyPrivateVotingContractArtifact
        const [deployerWallet, adminWallet] = wallets; // using first account as deployer and second as contract admin
        const adminAddress = adminWallet.getCompleteAddress().address;

        const deploymentData = getContractInstanceFromDeployParams(VotingContractArtifact,
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

        expect(await pxe.getContractInstance(deploymentData.address)).toBeDefined();
        expect(await pxe.isContractPubliclyDeployed(deploymentData.address)).toBeTruthy();
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

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        await contract.methods.cast_vote(candidate).send().wait();

      // We try voting again, but our TX is dropped due to trying to emit duplicate nullifiers
      // first confirm that it fails simulation
      await expect(contract.methods.cast_vote(candidate).send().wait()).rejects.toThrow(/Nullifier collision/);
      // if we skip simulation, tx is dropped
      await expect(
        contract.methods.cast_vote(candidate).send({ skipPublicSimulation: true }).wait(),
      ).rejects.toThrow('Reason: Tx dropped by P2P node.');

    }, 300_000)

    it("It casts a delegated vote", async () => {
        const candidate = new Fr(1)
        const delegatee = accounts[1].address
        const random = new Fr(2)

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        await contract.methods.delegate_vote(delegatee, random).send().wait();
        
        const tx = await contract.withWallet(wallets[1]).methods.cast_delegated_vote(accounts[0].address, candidate).send().wait();
        let count = await contract.methods.get_vote(candidate).simulate();
        expect(count).toBe(1n);
    }, 300_000)

    it("It should fail when trying to both delegate and vote", async () => {
        const candidate = new Fr(1)
        const delegatee = accounts[1].address
        const random = new Fr(2)

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        await contract.methods.delegate_vote(delegatee, random).send().wait();

        // We try voting again, but our TX is dropped due to trying to emit duplicate nullifiers
        // first confirm that it fails simulation
        await expect(contract.methods.cast_vote(candidate).send().wait()).rejects.toThrow(/Nullifier collision/);
        // if we skip simulation, tx is dropped
        await expect(
            contract.methods.cast_vote(candidate).send({ skipPublicSimulation: true }).wait(),
        ).rejects.toThrow('Reason: Tx dropped by P2P node.');
    }, 300_000)

});
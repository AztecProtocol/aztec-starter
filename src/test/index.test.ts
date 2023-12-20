import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, Contract, ContractDeployer, DeployMethod, Fr, PXE, TxStatus, createAccount, createPXEClient, getContractDeploymentInfo, getSandboxAccountsWallets, waitForSandbox } from "@aztec/aztec.js";

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = createPXEClient(PXE_URL);
    await waitForSandbox(pxe);
    return pxe;
};

describe("Voting", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];

    beforeAll(async () => {
        pxe = await setupSandbox();

        wallets = await getSandboxAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress())
    })

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const publicKey = accounts[0].publicKey
        const VotingContractArtifact = EasyPrivateVotingContractArtifact
        const deployArgs = accounts[0].address

        const deploymentData = getContractDeploymentInfo(VotingContractArtifact, [deployArgs], salt, publicKey);
        const deployer = new ContractDeployer(VotingContractArtifact, pxe, publicKey);
        const tx = deployer.deploy(deployArgs).send({ contractAddressSalt: salt })
        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
                error: '',
            }),
        );

        const receiptAfterMined = await tx.wait();

        expect(receiptAfterMined).toEqual(
            expect.objectContaining({
                status: TxStatus.MINED,
                error: '',
                contractAddress: deploymentData.completeAddress.address,
            }),
        );
    })

    it("It casts a vote", async () => {
        const candidate = new Fr(1)

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        const tx = await contract.methods.cast_vote(candidate).send().wait();
        let count = await contract.methods.get_vote(candidate).view();
        expect(count).toBe(1n);
    })

});
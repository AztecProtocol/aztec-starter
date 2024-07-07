import { EasyPrivateVotingContractArtifact, EasyPrivateVotingContract } from "../artifacts/EasyPrivateVoting.js"
import { AccountWallet, CompleteAddress, ContractDeployer, Fr, PXE, waitForPXE, TxStatus, createPXEClient, getContractInstanceFromDeployParams, deriveKeys } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing"

const setupSandbox = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

describe("Voting", () => {
    let pxe: PXE;
    let wallets: AccountWallet[] = [];
    let accounts: CompleteAddress[] = [];

    beforeAll(async () => {
        pxe = await setupSandbox();

        wallets = await getInitialTestAccountsWallets(pxe);
        accounts = wallets.map(w => w.getCompleteAddress())
    })

    it("Deploys the contract", async () => {
        const salt = Fr.random();
        const VotingContractArtifact = EasyPrivateVotingContractArtifact
        const deployArgs = wallets[0].getCompleteAddress().address

        const deploymentData = getContractInstanceFromDeployParams(VotingContractArtifact,
            {
                constructorArgs: [deployArgs],
                salt,
                deployer: wallets[0].getAddress()
            });
        const deployer = new ContractDeployer(VotingContractArtifact, wallets[0]);
        const tx = deployer.deploy(deployArgs).send({ contractAddressSalt: salt })
        const receipt = await tx.getReceipt();

        expect(receipt).toEqual(
            expect.objectContaining({
                status: TxStatus.PENDING,
                error: ''
            }),
        );

        const receiptAfterSuccess = await tx.wait({ wallet: wallets[0] });

        expect(await pxe.getContractInstance(deploymentData.address)).toBeDefined();
        expect(await pxe.isContractPubliclyDeployed(deploymentData.address)).toBeDefined();
        expect(receiptAfterSuccess).toEqual(
            expect.objectContaining({
                status: TxStatus.SUCCESS,
            }),
        );

        expect(receiptAfterSuccess.contract.instance.address).toEqual(deploymentData.address)
    }, 300_000)

    it("It casts a vote", async () => {
        const candidate = new Fr(1)

        const contract = await EasyPrivateVotingContract.deploy(wallets[0], accounts[0].address).send().deployed();
        const tx = await contract.methods.cast_vote(candidate).send().wait();
        let count = await contract.methods.get_vote(candidate).simulate();
        expect(count).toBe(1n);
    }, 300_000)

});
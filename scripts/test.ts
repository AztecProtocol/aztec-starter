import { PXE, waitForPXE, createPXEClient, getContractInstanceFromDeployParams, Fr, ContractInstanceWithAddress, AztecAddress, SponsoredFeePaymentMethod } from "@aztec/aztec.js";
import { TokenContract } from "@aztec/noir-contracts.js/Token"
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing";
import { getDeployedSponsoredFPCAddress, getSponsoredFPCInstance } from "../src/utils/sponsored_fpc.js";
import { deriveSigningKey } from "@aztec/stdlib/keys";
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { SponsoredFPCContract } from "@aztec/noir-contracts.js/SponsoredFPC";

const setupPxe1 = async () => {
    const { PXE_URL = 'http://localhost:8080' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const setupPxe2 = async () => {
    const { PXE_URL = 'http://localhost:8081' } = process.env;
    const pxe = await createPXEClient(PXE_URL);
    await waitForPXE(pxe);
    return pxe;
};

const L2_TOKEN_CONTRACT_SALT=Fr.random();

export async function getL2TokenContractInstance(ownerWallet: any, ownerAztecAddress: AztecAddress): Promise<ContractInstanceWithAddress> {
    return await getContractInstanceFromDeployParams(
      TokenContract.artifact,
      {
        salt: L2_TOKEN_CONTRACT_SALT,
        constructorArgs: [    
          ownerAztecAddress,
          'Clean USDC',
          'USDC',
          6
      ]
      }
    )
  }

async function main() {

    const pxe1 = await setupPxe1();
    const pxe2 = await setupPxe2();

    const wallets = await getInitialTestAccountsWallets(pxe1);
    const ownerAddress = wallets[0].getAddress()
    const token = await TokenContract.deploy(wallets[0], ownerAddress, 'Clean USDC', 'USDC', 6).send({contractAddressSalt: L2_TOKEN_CONTRACT_SALT}).wait()
  
     const sponseredFPC = await getSponsoredFPCInstance();
     await pxe2.registerContract({instance: sponseredFPC, artifact: SponsoredFPCContract.artifact});
     const paymentMethod = new SponsoredFeePaymentMethod(sponseredFPC.address);
     pxe2.registerSender(ownerAddress)

    let secretKey = Fr.random();
    let salt = Fr.random();

    let schnorrAccount = await getSchnorrAccount(pxe2, secretKey, deriveSigningKey(secretKey), salt);

    const private_mint_tx = await token.contract.methods.mint_to_private(ownerAddress, schnorrAccount.getAddress(), 100).send().wait()
    console.log(await pxe1.getTxEffect(private_mint_tx.txHash))
    await token.contract.methods.mint_to_public(schnorrAccount.getAddress(), 100).send().wait()

    let tx = await schnorrAccount.deploy({ fee: { paymentMethod } }).wait();
    let wallet = await schnorrAccount.getWallet();

    const l2TokenContractInstance = await getL2TokenContractInstance(wallets[0], ownerAddress)
    await wallet.registerContract({
        instance: l2TokenContractInstance
      })

     const l2TokenContract = await TokenContract.at(
       l2TokenContractInstance.address,
       wallet
     )

    await l2TokenContract.methods.sync_notes().simulate()

    const notes = await pxe2.getNotes({ txHash: private_mint_tx.txHash });
    console.log(notes)

    const balance = await l2TokenContract.methods.balance_of_private(wallet.getAddress()).simulate()
    console.log("private balance should be 100", balance)
    const public_balance = await l2TokenContract.methods.balance_of_public(wallet.getAddress()).simulate()
   
}

main();

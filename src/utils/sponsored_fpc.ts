import { Fr } from '@aztec/aztec.js/fields';
import {
  getContractInstanceFromInstantiationParams,
  type ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { LogFn } from '@aztec/foundation/log';
import { SponsoredFPCContract, SponsoredFPCContractArtifact } from '@aztec/noir-contracts.js/SponsoredFPC';
import { SPONSORED_FPC_SALT } from '@aztec/constants';

// docs:start:get-sponsored-fpc
export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromInstantiationParams(SponsoredFPCContractArtifact, {
    salt: new Fr(SPONSORED_FPC_SALT),
  });
}
// docs:end:get-sponsored-fpc

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address;
}

export async function setupSponsoredFPC(deployer: Wallet, log: LogFn) {
  const [{ item: from }] = await deployer.getAccounts();
  const deployRequest = SponsoredFPCContract.deploy(deployer);
  // Simulate before sending to surface revert reasons
  await deployRequest.simulate({ from });
  const deployed = await deployRequest
    .send({
      from,
      contractAddressSalt: new Fr(SPONSORED_FPC_SALT),
      universalDeploy: true,
    });

  log(`SponsoredFPC: ${deployed.address}`);
}

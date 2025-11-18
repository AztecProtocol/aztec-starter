import { Fr } from '@aztec/aztec.js/fields';
import {
  getContractInstanceFromInstantiationParams,
  type ContractInstanceWithAddress,
} from '@aztec/aztec.js/contracts';
import type { Wallet } from '@aztec/aztec.js/wallet';
import type { LogFn } from '@aztec/foundation/log';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';

const SPONSORED_FPC_SALT = new Fr(0);

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromInstantiationParams(SponsoredFPCContract.artifact, {
    salt: SPONSORED_FPC_SALT,
  });
}

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address;
}

export async function setupSponsoredFPC(deployer: Wallet, log: LogFn) {
  const [{ item: from }] = await deployer.getAccounts();
  const deployed = await SponsoredFPCContract.deploy(deployer)
    .send({
      from,
      contractAddressSalt: SPONSORED_FPC_SALT,
      universalDeploy: true,
    })
    .deployed();

  log(`SponsoredFPC: ${deployed.address}`);
}

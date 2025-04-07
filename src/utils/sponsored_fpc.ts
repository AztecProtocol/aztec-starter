import {
  type ContractInstanceWithAddress,
  Fr,
  type PXE,
  getContractInstanceFromDeployParams,
} from '@aztec/aztec.js';
import { SponsoredFPCContract } from '@aztec/noir-contracts.js/SponsoredFPC';

const SPONSORED_FPC_SALT = new Fr(0);

export async function getSponsoredFPCInstance(): Promise<ContractInstanceWithAddress> {
  return await getContractInstanceFromDeployParams(SponsoredFPCContract.artifact, {
    salt: SPONSORED_FPC_SALT,
  });
}

export async function getSponsoredFPCAddress() {
  return (await getSponsoredFPCInstance()).address;
}

export async function getDeployedSponsoredFPCAddress(pxe: PXE) {
  const fpc = await getSponsoredFPCAddress();
  const contracts = await pxe.getContracts();
  if (!contracts.find(c => c.equals(fpc))) {
    throw new Error('SponsoredFPC not deployed.');
  }
  return fpc;
}

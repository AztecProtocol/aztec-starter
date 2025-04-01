import { createLogger, Fr, createPXEClient, createAztecNodeClient, AztecAddress, L1FeeJuicePortalManager } from "@aztec/aztec.js";
import { getInitialTestAccountsWallets } from "@aztec/accounts/testing"
import { getSchnorrAccount } from "@aztec/accounts/schnorr";
import { deriveSigningKey } from '@aztec/stdlib/keys';
import type { ContractInstanceWithAddress } from '@aztec/aztec.js';
import { createEthereumChain, createL1Clients } from '@aztec/ethereum';
import { TokenContract, TokenContractArtifact } from "@aztec/noir-contracts.js/Token";
import { AMMContract, AMMContractArtifact } from "@aztec/noir-contracts.js/AMM";
import { FeeJuicePaymentMethodWithClaim } from '@aztec/aztec.js/fee';

import { promises as fs } from "fs";
import { NFTContract, NFTContractArtifact } from "@aztec/noir-contracts.js/NFT";

type AMMContractMetadata = {
  ammAddress: string,
  token0Address: string,
  token1Address: string,
  tokenLiquidityAddress: string,
  type: 'amm',
  inited: boolean
};

type TokenContractMetadata = {
  address: string,
  type: 'token',
  inited: boolean
};

type NFTContractMetadata = {
  address: string,
  type: 'nft',
  token_id: number,
  inited: boolean
};

type Account = {
  secretKey: string,
  address: string,
  salt: string,
  inited: boolean
}

type TestState = {
  accounts: Account[],
  contracts: (TokenContractMetadata | NFTContractMetadata | AMMContractMetadata)[]
}

(async () => {
  const state: TestState = JSON.parse(await fs.readFile('./state.json', 'utf8'));

  // TODO: Create new PXE's for each run / account
  const pxe = createPXEClient("http://34.82.76.226:8081");
  const node = createAztecNodeClient("http://34.82.76.226:8081");

  const mnemonic = 'test test test test test test test test test test test junk';
  const l1RpcUrl = 'http://35.233.242.32:8545';
  const chainId = 1337;

  const MAX_ACCOUNTS = 2
  const NEW_ACCOUNTS_PER_RUN = 2;

  const MAX_TOKEN_CONTRACTS = 1;
  const NEW_TOKEN_CONTRACTS_PER_RUN = 1;

  const MAX_AMM_CONTRACTS = 1;
  const NEW_AMM_CONTRACTS_PER_RUN = 1;

  const MAX_NFT_CONTRACTS = 1;
  const NEW_NFT_CONTRACTS_PER_RUN = 1;

  const contracts = state.contracts;

  const tokenContracts = contracts.filter(contract => contract.type === 'token');
  const ammContracts = contracts.filter(contract => contract.type === 'amm');
  const nftContracts = contracts.filter(contract => contract.type === 'nft');

  const testAccountWallets = await getInitialTestAccountsWallets(pxe);

  const accounts = state.accounts;

  const accountManagers = await Promise.all(state.accounts.map(account => getSchnorrAccount(pxe, Fr.fromString(account.secretKey), deriveSigningKey(Fr.fromString(account.secretKey)), Fr.fromString(account.salt))));
  await Promise.all(accountManagers.map(accountManager => accountManager.register()));

  const addNewTokenContracts = async () => {
    for (let i = 0; i < Math.min(MAX_TOKEN_CONTRACTS - tokenContracts.length, NEW_TOKEN_CONTRACTS_PER_RUN); i++) {
      const contract = await TokenContract.deploy(testAccountWallets[0], testAccountWallets[0].getAddress(), 'TokenName', 'TokenSymbol', 18)
        .send()
        .deployed();
  
      tokenContracts.push({
        address: contract.address.toString(),
        type: 'token',
        inited: false
      });
    };
  }

  const addNewNFTContracts = async () => {
    for (let i = 0; i < Math.min(MAX_NFT_CONTRACTS - nftContracts.length, NEW_NFT_CONTRACTS_PER_RUN); i++) {
      const contract = await NFTContract.deploy(testAccountWallets[0], testAccountWallets[0].getAddress(), 'TokenName', 'TokenSymbol')
        .send()
        .deployed();
  
      nftContracts.push({
        address: contract.address.toString(),
        type: 'nft',
        token_id: 1,
        inited: false
      });
    };
  }

  const addNewAMMContracts = async () => {
    for (let i = 0; i < Math.min(MAX_AMM_CONTRACTS - ammContracts.length, NEW_AMM_CONTRACTS_PER_RUN); i++) {
      const token0Contract = await TokenContract.deploy(testAccountWallets[0], testAccountWallets[0].getAddress(), 'TokenName', 'TokenSymbol', 18)
        .send()
        .deployed();
  
      const token1Contract = await TokenContract.deploy(testAccountWallets[0], testAccountWallets[0].getAddress(), 'TokenName', 'TokenSymbol', 18)
        .send()
        .deployed();
  
      const tokenLiquidityContract = await TokenContract.deploy(testAccountWallets[0], testAccountWallets[0].getAddress(), 'TokenName', 'TokenSymbol', 18)
        .send()
        .deployed();
  
      const ammContract = await AMMContract.deploy(testAccountWallets[0], token0Contract.address, token1Contract.address, tokenLiquidityContract.address)
        .send()
        .deployed();
  
      ammContracts.push({
        token0Address: token0Contract.address.toString(),
        token1Address: token1Contract.address.toString(),
        tokenLiquidityAddress: tokenLiquidityContract.address.toString(),
        ammAddress: ammContract.address.toString(),
        type: 'amm',
        inited: false
      });
    }
  }

  const addNewAccounts = async () => {
    const chain = createEthereumChain([l1RpcUrl], chainId);
    const { publicClient, walletClient } = createL1Clients(chain.rpcUrls, mnemonic, chain.chainInfo);

    const {
      protocolContractAddresses: { feeJuice: feeJuiceAddress },
    } = await pxe.getPXEInfo();

    const portal = await L1FeeJuicePortalManager.new(pxe, publicClient, walletClient, createLogger('Portal'));

    for (let i = 0; i < Math.min(MAX_ACCOUNTS - accounts.length, NEW_ACCOUNTS_PER_RUN); i++) {
      const secretKey = Fr.random();
      const salt = Fr.random();

      const schnorrAccount = await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt);

      const newAccountAddress = schnorrAccount.getAddress();

      const { claimAmount, claimSecret, messageHash, messageLeafIndex } = await portal.bridgeTokensPublic(
        newAccountAddress,
        999999999999999999999n,
        true,
      );
  
      const delayedCheck = (delay: number) => {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            void pxe
              .getL1ToL2MembershipWitness(feeJuiceAddress, Fr.fromHexString(messageHash), claimSecret)
              .then(witness => resolve(witness))
              .catch(err => reject(err));
          }, delay);
        });
      };
  
      let witness;
  
      let interval = 1000
      while (!witness) {
        witness = await delayedCheck(interval);
        if (!witness) {
          console.log(`No L1 to L2 message found yet, checking again in ${interval / 1000}s`);
        }
      }
      
      const feePaymentMethod = new FeeJuicePaymentMethodWithClaim(await schnorrAccount.getWallet(), {
        claimAmount: (typeof claimAmount === 'string'
          ? Fr.fromHexString(claimAmount)
          : new Fr(claimAmount)
        ).toBigInt(),
        claimSecret,
        messageLeafIndex: BigInt(messageLeafIndex),
      });

      await schnorrAccount.deploy({ fee: { paymentMethod: feePaymentMethod } }).wait();
  
      accounts.push({
        secretKey: secretKey.toString(),
        salt: salt.toString(),
        address: newAccountAddress.toString(),
        inited: false
      });

      accountManagers.push(await getSchnorrAccount(pxe, secretKey, deriveSigningKey(secretKey), salt));
    };
  }

  await addNewTokenContracts();
  await addNewNFTContracts();
  await addNewAMMContracts();
  await addNewAccounts();

  const processTokenContracts = async () => {
    for (let i = 0; i < accounts.length; i++) {
      const currentAccount = accounts[i];
      const currentAccountManager = accountManagers[i];

      await Promise.all(tokenContracts.map(async contract => {
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(contract.address!)) as ContractInstanceWithAddress, artifact: TokenContractArtifact})
      }));

      for (let i = 0; i < tokenContracts.length; i++) {
        if (currentAccount.inited === false || tokenContracts[i].inited === false) {
          const tokenAsMinter = await TokenContract.at(AztecAddress.fromString(tokenContracts[i].address), testAccountWallets[0]);
          const from = testAccountWallets[0].getAddress(); // we are setting from to minter here because we need a sender to calculate the tag
          await tokenAsMinter.methods.mint_to_private(from, AztecAddress.fromString(currentAccount.address), 999999999999999999999n).send().wait();
          await tokenAsMinter.methods.mint_to_public(AztecAddress.fromString(currentAccount.address), 999999999999999999999n).send().wait();
        }
      }
  
      const otherAccounts = accounts.filter(account => account.address !== currentAccount.address);
  
      await Promise.all(tokenContracts.map(async contract => {
        const tokenContract = await TokenContract.at(AztecAddress.fromString(contract.address!), await currentAccountManager.getWallet());
  
        const privateBalance = await tokenContract.methods.balance_of_private(AztecAddress.fromString(currentAccount.address)).simulate();
        const publicBalance = await tokenContract.methods.balance_of_public(AztecAddress.fromString(currentAccount.address)).simulate();
  
        const amountToTransferPrivate = privateBalance / 2 / otherAccounts.length;
        const amountToTransferPublic = publicBalance / 2 / otherAccounts.length;
  
        for (let i = 0; i < otherAccounts.length; i++) {
          await tokenContract.methods.transfer_in_private(AztecAddress.fromString(currentAccount.address), AztecAddress.fromString(otherAccounts[i].address), amountToTransferPrivate, 0).send().wait();
          await tokenContract.methods.transfer_in_public(AztecAddress.fromString(currentAccount.address), AztecAddress.fromString(otherAccounts[i].address), amountToTransferPublic, 0).send().wait();
        }
      }));
    }
  }

  await processTokenContracts();

  const processNFTContracts = async () => {
    const NFTS_TO_MINT = 2;
    const NFTS_TO_TRANSFER = 1;

    for (let i = 0; i < accounts.length; i++) {
      const currentAccount = accounts[i];
      const currentAccountManager = accountManagers[i];

      await Promise.all(nftContracts.map(async contract => {
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(contract.address!!)) as ContractInstanceWithAddress, artifact: NFTContractArtifact})
      }));


      for (let i = 0; i < nftContracts.length; i++) {
        if (currentAccount.inited === false || nftContracts[i].inited === false) {
          const nftAsMinter = await NFTContract.at(AztecAddress.fromString(nftContracts[i].address), testAccountWallets[0]);
          const nftAsCurrent = await NFTContract.at(AztecAddress.fromString(nftContracts[i].address), await currentAccountManager.getWallet());

          for (let i = 0; i < NFTS_TO_MINT; i++) {
            await nftAsMinter.methods.mint(AztecAddress.fromString(currentAccount.address), nftContracts[i].token_id).send().wait();
            await nftAsCurrent.methods.transfer_to_private(AztecAddress.fromString(currentAccount.address), nftContracts[i].token_id++).send().wait();
          }
        } 
      }

      const otherAccounts = accounts.filter(account => account.address !== currentAccount.address);

      await Promise.all(nftContracts.map(async contract => {
        const nftContract = await NFTContract.at(AztecAddress.fromString(contract.address!), await currentAccountManager.getWallet());

        const [nfts] = await nftContract.methods.get_private_nfts(AztecAddress.fromString(currentAccount.address), 0).simulate();

        for (let i = 0; i < Math.min(nfts.length, NFTS_TO_TRANSFER); i++) {
          await nftContract.methods.transfer_in_private(AztecAddress.fromString(currentAccount.address), AztecAddress.fromString(otherAccounts[Math.floor(Math.random() * otherAccounts.length)].address), nfts[i], 0).send().wait();
        }
      }));
    }
  }

  await processNFTContracts();

  const processAMMContracts = async () => {
    for (let i = 0; i < accounts.length; i++) {
      const currentAccount = accounts[i];
      const currentAccountManager = accountManagers[i];

      await Promise.all(ammContracts.map(async setup => {
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(setup.token0Address)) as ContractInstanceWithAddress, artifact: TokenContractArtifact})
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(setup.token1Address)) as ContractInstanceWithAddress, artifact: TokenContractArtifact})
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(setup.tokenLiquidityAddress)) as ContractInstanceWithAddress, artifact: TokenContractArtifact})
        pxe.registerContract({instance: await node.getContract(AztecAddress.fromString(setup.ammAddress)) as ContractInstanceWithAddress, artifact: AMMContractArtifact})
      }));

      for (let i = 0; i < ammContracts.length; i++) {
        if (currentAccount.inited === false || ammContracts[i].inited === false) {
          const tokenAsMinter = await TokenContract.at(AztecAddress.fromString(tokenContracts[i].address), testAccountWallets[0]);
          const from = testAccountWallets[0].getAddress(); // we are setting from to minter here because we need a sender to calculate the tag
          await tokenAsMinter.methods.mint_to_private(from, AztecAddress.fromString(currentAccount.address), 999999999999999999999n).send().wait();
        } 
      }

      for (let i = 0; i < ammContracts.length; i++) {
        const currentAccountWallet = await currentAccountManager.getWallet();
        const token0 = await TokenContract.at(AztecAddress.fromString(ammContracts[i].token0Address), currentAccountWallet);
        const token1 = await TokenContract.at(AztecAddress.fromString(ammContracts[i].token0Address), currentAccountWallet);
        const tokenLiquidity = await TokenContract.at(AztecAddress.fromString(ammContracts[i].tokenLiquidityAddress), currentAccountWallet);
        const amm = await AMMContract.at(AztecAddress.fromString(ammContracts[i].ammAddress), currentAccountWallet);

        const token0PrivateBalance = await token0.methods.balance_of_private(AztecAddress.fromString(currentAccount.address)).simulate();
        const token1PrivateBalance = await token1.methods.balance_of_private(AztecAddress.fromString(currentAccount.address)).simulate();

        const amount0Max = token0PrivateBalance / 4;
        const amount1Max = token1PrivateBalance / 4;

        let nonceForAuthwits = Fr.random();
        const token0Authwit = await (await accountManagers[i].getWallet()).createAuthWit({
          caller: AztecAddress.fromString(ammContracts[i].ammAddress),
          action: token0.methods.transfer_to_public(
            AztecAddress.fromString(currentAccount.address),
            AztecAddress.fromString(ammContracts[i].ammAddress),
            amount0Max,
            nonceForAuthwits,
          ),
        });
        const token1Authwit = await (await accountManagers[i].getWallet()).createAuthWit({
          caller: AztecAddress.fromString(ammContracts[i].ammAddress),
          action: token1.methods.transfer_to_public(
            AztecAddress.fromString(currentAccount.address),
            AztecAddress.fromString(ammContracts[i].ammAddress),
            amount1Max,
            nonceForAuthwits,
          ),
        });

        const addLiquidityInteraction = amm
          .withWallet(c)
          .methods.add_liquidity(amount0Max, amount1Max, 1, 1, nonceForAuthwits)
          .with({ authWitnesses: [token0Authwit, token1Authwit] });
        await addLiquidityInteraction.send().wait();

        const amountIn = token0PrivateBalance / 88;
        nonceForAuthwits = Fr.random();
        const swapAuthwit = await (await accountManagers[i].getWallet()).createAuthWit({
          caller: amm.address,
          action: token0.methods.transfer_to_public(AztecAddress.fromString(currentAccount.address), AztecAddress.fromString(ammContracts[i].ammAddress), amountIn, nonceForAuthwits),
        });

        const ammBalanceToken0 = await token0.methods.balance_of_public(amm.address).simulate();
        const ammBalanceToken1 = await token1.methods.balance_of_public(amm.address).simulate();

        // We compute the expected amount out and set it as the minimum. In a real-life scenario we'd choose a slightly
        // lower value to account for slippage, but since we're the only actor interacting with the AMM we can afford to
        // just pass the exact value. Of course any lower value would also suffice.
        const amountOutMin = await amm.methods
          .get_amount_out_for_exact_in(ammBalanceToken0, ammBalanceToken1, amountIn)
          .simulate();

        const swapExactTokensInteraction = amm
          .withWallet((await accountManagers[i].getWallet()))
          .methods.swap_exact_tokens_for_tokens(token0.address, token1.address, amountIn, amountOutMin, nonceForAuthwits)
          .with({ authWitnesses: [swapAuthwit] });
        await swapExactTokensInteraction.send().wait();

        const liquidityTokenBalance = await tokenLiquidity
          .withWallet((await accountManagers[i].getWallet()))
          .methods.balance_of_private(AztecAddress.fromString(currentAccount.address))
          .simulate();

        nonceForAuthwits = Fr.random();
        const liquidityAuthwit = await (await accountManagers[i].getWallet()).createAuthWit({
          caller: amm.address,
          action: tokenLiquidity.methods.transfer_to_public(
            AztecAddress.fromString(currentAccount.address),
            AztecAddress.fromString(ammContracts[i].ammAddress),
            liquidityTokenBalance,
            nonceForAuthwits,
          ),
        });
  
        const amount0Min = 1n;
        const amount1Min = 1n;
  
        const removeLiquidityInteraction = amm
          .withWallet((await accountManagers[i].getWallet()))
          .methods.remove_liquidity(liquidityTokenBalance, amount0Min, amount1Min, nonceForAuthwits)
          .with({ authWitnesses: [swapAuthwit] });

        removeLiquidityInteraction.send({ authWitnesses: [liquidityAuthwit] })
          .wait();
      }
    }
  }
  
  await processAMMContracts();
})()

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Debug.sol";

contract DeployDebug is Script {
    function run() public {
        string memory mnemonic = "test test test test test test test test test test test junk";
        uint256 deployerPrivateKey = vm.deriveKey(mnemonic, 0);
        vm.startBroadcast(deployerPrivateKey);

        Debug debug = new Debug();

        vm.stopBroadcast();
    }
} 
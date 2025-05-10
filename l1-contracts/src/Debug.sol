// SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

import {MerkleLib} from "@aztec/core/libraries/crypto/MerkleLib.sol";
import {IOutbox} from "@aztec/core/interfaces/messagebridge/IOutbox.sol";

contract Debug {
    function verifyL2MessageMembership(
        IOutbox outbox,
        uint256 l2BlockNumber,
        bytes32 messageHash,
        uint256 messageIndex,
        bytes32[] calldata siblingPath
    ) public view returns (bool) {
        (bytes32 root, ) = outbox.getRootData(l2BlockNumber);
 
        MerkleLib.verifyMembership(
            siblingPath,
            messageHash,
            messageIndex,
            root
        );

        return true;
    }
}
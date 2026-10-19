// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice A 6-decimal test token standing in for a stable unit on the Sepolia test network. No value.
contract TestUSD is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {
        _mint(msg.sender, 10_000_000 * 10 ** 6);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

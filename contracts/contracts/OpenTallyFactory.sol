// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {OpenTally} from "./OpenTally.sol";

/// @notice Creates programme instances and remembers the latest one, so a demo can be reset by deploying a fresh
///         programme without any database. Only the operator may create.
contract OpenTallyFactory {
    address public immutable operator;
    address[] private _instances;

    event Created(address indexed instance, uint256 index, string programmeName);

    error NotOperator();

    constructor(address operator_) {
        operator = operator_;
    }

    function create(
        IERC20 token,
        address verifier,
        address funder,
        uint256 grantPerConnection,
        OpenTally.Rule calldata rule,
        string calldata programmeName
    ) external returns (address instance) {
        if (msg.sender != operator) revert NotOperator();
        instance = address(new OpenTally(token, operator, verifier, funder, grantPerConnection, rule, programmeName));
        _instances.push(instance);
        emit Created(instance, _instances.length - 1, programmeName);
    }

    function latest() external view returns (address) {
        return _instances.length == 0 ? address(0) : _instances[_instances.length - 1];
    }

    function instanceCount() external view returns (uint256) {
        return _instances.length;
    }

    function instanceAt(uint256 index) external view returns (address) {
        return _instances[index];
    }
}

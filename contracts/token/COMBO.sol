pragma solidity ^0.6.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title Furucombo
 * @dev Furucombo Token contract. All tokens are pre-assigned to the creator.
 * Note they can later distribute these tokens as they wish using `transfer` and other
 * `StandardToken` functions.
 */
contract COMBO is ERC20 {
    using Address for address;
    using SafeMath for uint256;

    constructor() public ERC20("Furucombo", "COMBO") {
        // mint amount 100M
        uint256 supply = 100000000 * (10**uint256(decimals()));
        _mint(msg.sender, supply);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title DankToken
/// @notice Standardized DRC-20/ERC-20 memecoin minted once by DankFactory. The entire fixed
///         max supply is minted in the constructor and split between the bonding curve market
///         (tradable supply) and the market contract's graduation reserve (LP supply). There is
///         no mint function of any kind after construction, so creators can never inflate supply.
contract DankToken is ERC20 {
    /// @notice Address of the creator wallet that requested this token via the factory.
    address public immutable creator;

    /// @notice Off-chain metadata URI (IPFS/Arweave) set once at creation. Immutable on-chain
    ///         provenance for name/symbol/image/description/socials stored off-chain.
    string public metadataURI;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory metadataURI_,
        address creator_,
        address curveMarket_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        creator = creator_;
        metadataURI = metadataURI_;
        // Mint the entire fixed supply directly to the bonding curve market. The market
        // contract is responsible for splitting it into curve-sellable vs. graduation-reserve
        // tranches; DankToken itself has no notion of that split.
        _mint(curveMarket_, totalSupply_);
    }

    /// @dev Fixed at 18 decimals for every token the factory creates, matching the standardized
    ///      trading configuration principle (every token behaves identically).
    function decimals() public pure override returns (uint8) {
        return 18;
    }
}

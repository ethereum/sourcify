// SPDX-License-Identifier: MIT
pragma solidity 0.7.5;

import "./Proprietor.sol";

/**
 * @title TCAP Treasury
 * @author Cryptex.finance
 * @notice This contract will hold the assets generated on L2 networks.
 */
contract ITreasury is Proprietor {
	/// @notice An event emitted when a transaction is executed
	event TransactionExecuted(
		address indexed target,
		uint256 value,
		string signature,
		bytes data
	);


	/**
	 * @notice Constructor
	 * @param _owner the owner of the contract
	 */
	constructor(address _owner) Proprietor(_owner) {}

	/**
	 * @notice Allows the owner to execute custom transactions
	 * @param target address
	 * @param value uint256
	 * @param signature string
	 * @param data bytes
	 * @dev Only owner can call it
	 */
	function executeTransaction(
		address target,
		uint256 value,
		string memory signature,
		bytes memory data
	) external payable onlyOwner returns (bytes memory) {
		bytes memory callData;
		if (bytes(signature).length == 0) {
			callData = data;
		} else {
			callData = abi.encodePacked(bytes4(keccak256(bytes(signature))), data);
		}

		require(
			target != address(0),
			"ITreasury::executeTransaction: target can't be zero"
		);

		// solium-disable-next-line security/no-call-value
		(bool success, bytes memory returnData) =
		target.call{value : value}(callData);
		require(
			success,
			"ITreasury::executeTransaction: Transaction execution reverted."
		);

		emit TransactionExecuted(target, value, signature, data);
		(target, value, signature, data);

		return returnData;
	}

	/**
	 * @notice Retrieves the eth stuck on the treasury
	 * @param _to address
	 * @dev Only owner can call it
	 */
	function retrieveETH(address _to) external onlyOwner {
		require(
			_to != address(0),
			"ITreasury::retrieveETH: address can't be zero"
		);
		uint256 amount = address(this).balance;
		payable(_to).transfer(amount);
	}

	/// @notice Allows the contract to receive ETH
	receive() external payable {}
}

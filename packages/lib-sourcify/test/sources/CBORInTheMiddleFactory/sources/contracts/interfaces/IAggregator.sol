{
  "content": "// SPDX-License-Identifier: GPL-3.0\npragma solidity >=0.7.5;\n\nimport \"./PackedUserOperation.sol\";\n\n/**\n * Aggregated Signatures validator.\n */\ninterface IAggregator {\n    /**\n     * Validate aggregated signature.\n     * Revert if the aggregated signature does not match the given list of operations.\n     * @param userOps   - Array of UserOperations to validate the signature for.\n     * @param signature - The aggregated signature.\n     */\n    function validateSignatures(\n        PackedUserOperation[] calldata userOps,\n        bytes calldata signature\n    ) external view;\n\n    /**\n     * Validate signature of a single userOp.\n     * This method should be called by bundler after EntryPointSimulation.simulateValidation() returns\n     * the aggregator this account uses.\n     * First it validates the signature over the userOp. Then it returns data to be used when creating the handleOps.\n     * @param userOp        - The userOperation received from the user.\n     * @return sigForUserOp - The value to put into the signature field of the userOp when calling handleOps.\n     *                        (usually empty, unless account and aggregator support some kind of \"multisig\".\n     */\n    function validateUserOpSignature(\n        PackedUserOperation calldata userOp\n    ) external view returns (bytes memory sigForUserOp);\n\n    /**\n     * Aggregate multiple signatures into a single value.\n     * This method is called off-chain to calculate the signature to pass with handleOps()\n     * bundler MAY use optimized custom code perform this aggregation.\n     * @param userOps              - Array of UserOperations to collect the signatures from.\n     * @return aggregatedSignature - The aggregated signature.\n     */\n    function aggregateSignatures(\n        PackedUserOperation[] calldata userOps\n    ) external view returns (bytes memory aggregatedSignature);\n}\n"
}
{
  "content": "// SPDX-License-Identifier: GPL-3.0\npragma solidity ^0.8.23;\n\n/* solhint-disable no-empty-blocks */\n\nimport \"@openzeppelin/contracts/utils/introspection/IERC165.sol\";\nimport \"@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol\";\nimport \"@openzeppelin/contracts/token/ERC1155/IERC1155Receiver.sol\";\n\n/**\n * Token callback handler.\n *   Handles supported tokens' callbacks, allowing account receiving these tokens.\n */\nabstract contract TokenCallbackHandler is IERC721Receiver, IERC1155Receiver {\n\n    function onERC721Received(\n        address,\n        address,\n        uint256,\n        bytes calldata\n    ) external pure override returns (bytes4) {\n        return IERC721Receiver.onERC721Received.selector;\n    }\n\n    function onERC1155Received(\n        address,\n        address,\n        uint256,\n        uint256,\n        bytes calldata\n    ) external pure override returns (bytes4) {\n        return IERC1155Receiver.onERC1155Received.selector;\n    }\n\n    function onERC1155BatchReceived(\n        address,\n        address,\n        uint256[] calldata,\n        uint256[] calldata,\n        bytes calldata\n    ) external pure override returns (bytes4) {\n        return IERC1155Receiver.onERC1155BatchReceived.selector;\n    }\n\n    function supportsInterface(bytes4 interfaceId) external view virtual override returns (bool) {\n        return\n            interfaceId == type(IERC721Receiver).interfaceId ||\n            interfaceId == type(IERC1155Receiver).interfaceId ||\n            interfaceId == type(IERC165).interfaceId;\n    }\n}\n"
}
export default {
  compiler: { version: "0.6.12+commit.27d51765" },
  language: "Solidity",
  output: {
    abi: [
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "owner",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "spender",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        name: "Approval",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "delegator",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "fromDelegate",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "toDelegate",
            type: "address",
          },
        ],
        name: "DelegateChanged",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "delegate",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "previousBalance",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "newBalance",
            type: "uint256",
          },
        ],
        name: "DelegateVotesChanged",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "previousOwner",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "newOwner",
            type: "address",
          },
        ],
        name: "OwnershipTransferred",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "from",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "value",
            type: "uint256",
          },
        ],
        name: "Transfer",
        type: "event",
      },
      {
        inputs: [],
        name: "DELEGATION_TYPEHASH",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "DOMAIN_TYPEHASH",
        outputs: [{ internalType: "bytes32", name: "", type: "bytes32" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "owner", type: "address" },
          { internalType: "address", name: "spender", type: "address" },
        ],
        name: "allowance",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "spender", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "balanceOf",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "cap",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "", type: "address" },
          { internalType: "uint32", name: "", type: "uint32" },
        ],
        name: "checkpoints",
        outputs: [
          { internalType: "uint32", name: "fromBlock", type: "uint32" },
          { internalType: "uint256", name: "votes", type: "uint256" },
        ],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "spender", type: "address" },
          {
            internalType: "uint256",
            name: "subtractedValue",
            type: "uint256",
          },
        ],
        name: "decreaseAllowance",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "delegatee", type: "address" },
        ],
        name: "delegate",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "delegatee", type: "address" },
          { internalType: "uint256", name: "nonce", type: "uint256" },
          { internalType: "uint256", name: "expiry", type: "uint256" },
          { internalType: "uint8", name: "v", type: "uint8" },
          { internalType: "bytes32", name: "r", type: "bytes32" },
          { internalType: "bytes32", name: "s", type: "bytes32" },
        ],
        name: "delegateBySig",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "delegator", type: "address" },
        ],
        name: "delegates",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "getCurrentBlock",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "getCurrentVotes",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          {
            internalType: "uint256",
            name: "blockNumber",
            type: "uint256",
          },
        ],
        name: "getPriorVotes",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "spender", type: "address" },
          { internalType: "uint256", name: "addedValue", type: "uint256" },
        ],
        name: "increaseAllowance",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "_to", type: "address" },
          { internalType: "uint256", name: "_amount", type: "uint256" },
        ],
        name: "mint",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "name",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "nonces",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "numCheckpoints",
        outputs: [{ internalType: "uint32", name: "", type: "uint32" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "owner",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "renounceOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "symbol",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "totalSupply",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "sender", type: "address" },
          { internalType: "address", name: "recipient", type: "address" },
          { internalType: "uint256", name: "amount", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "newOwner", type: "address" },
        ],
        name: "transferOwnership",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    devdoc: {
      kind: "dev",
      methods: {
        "allowance(address,address)": { details: "See {IERC20-allowance}." },
        "approve(address,uint256)": {
          details:
            "See {IERC20-approve}. Requirements: - `spender` cannot be the zero address.",
        },
        "balanceOf(address)": { details: "See {IERC20-balanceOf}." },
        "cap()": { details: "Returns the cap on the token's total supply." },
        "decimals()": {
          details:
            "Returns the number of decimals used to get its user representation. For example, if `decimals` equals `2`, a balance of `505` tokens should be displayed to a user as `5,05` (`505 / 10 ** 2`). Tokens usually opt for a value of 18, imitating the relationship between Ether and Wei. This is the value {ERC20} uses, unless {_setupDecimals} is called. NOTE: This information is only used for _display_ purposes: it in no way affects any of the arithmetic of the contract, including {IERC20-balanceOf} and {IERC20-transfer}.",
        },
        "decreaseAllowance(address,uint256)": {
          details:
            "Atomically decreases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address. - `spender` must have allowance for the caller of at least `subtractedValue`.",
        },
        "delegate(address)": {
          params: { delegatee: "The address to delegate votes to" },
        },
        "delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)": {
          params: {
            delegatee: "The address to delegate votes to",
            expiry: "The time at which to expire the signature",
            nonce: "The contract state required to match the signature",
            r: "Half of the ECDSA signature pair",
            s: "Half of the ECDSA signature pair",
            v: "The recovery byte of the signature",
          },
        },
        "delegates(address)": {
          params: { delegator: "The address to get delegatee for" },
        },
        "getCurrentVotes(address)": {
          params: { account: "The address to get votes balance" },
          returns: { _0: "The number of current votes for `account`" },
        },
        "getPriorVotes(address,uint256)": {
          details:
            "Block number must be a finalized block or else this function will revert to prevent misinformation.",
          params: {
            account: "The address of the account to check",
            blockNumber: "The block number to get the vote balance at",
          },
          returns: {
            _0: "The number of votes the account had as of the given block",
          },
        },
        "increaseAllowance(address,uint256)": {
          details:
            "Atomically increases the allowance granted to `spender` by the caller. This is an alternative to {approve} that can be used as a mitigation for problems described in {IERC20-approve}. Emits an {Approval} event indicating the updated allowance. Requirements: - `spender` cannot be the zero address.",
        },
        "name()": { details: "Returns the name of the token." },
        "owner()": { details: "Returns the address of the current owner." },
        "renounceOwnership()": {
          details:
            "Leaves the contract without owner. It will not be possible to call `onlyOwner` functions anymore. Can only be called by the current owner. NOTE: Renouncing ownership will leave the contract without an owner, thereby removing any functionality that is only available to the owner.",
        },
        "symbol()": {
          details:
            "Returns the symbol of the token, usually a shorter version of the name.",
        },
        "totalSupply()": { details: "See {IERC20-totalSupply}." },
        "transfer(address,uint256)": {
          details:
            "See {IERC20-transfer}. Requirements: - `recipient` cannot be the zero address. - the caller must have a balance of at least `amount`.",
        },
        "transferFrom(address,address,uint256)": {
          details:
            "See {IERC20-transferFrom}. Emits an {Approval} event indicating the updated allowance. This is not required by the EIP. See the note at the beginning of {ERC20}; Requirements: - `sender` and `recipient` cannot be the zero address. - `sender` must have a balance of at least `amount`. - the caller must have allowance for ``sender``'s tokens of at least `amount`.",
        },
        "transferOwnership(address)": {
          details:
            "Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.",
        },
      },
      stateVariables: {
        _delegates: { details: "A record of each accounts delegate" },
      },
      version: 1,
    },
    userdoc: {
      events: {
        "DelegateChanged(address,address,address)": {
          notice: "An event thats emitted when an account changes its delegate",
        },
        "DelegateVotesChanged(address,uint256,uint256)": {
          notice:
            "An event thats emitted when a delegate account's vote balance changes",
        },
      },
      kind: "user",
      methods: {
        "DELEGATION_TYPEHASH()": {
          notice:
            "The EIP-712 typehash for the delegation struct used by the contract",
        },
        "DOMAIN_TYPEHASH()": {
          notice: "The EIP-712 typehash for the contract's domain",
        },
        "checkpoints(address,uint32)": {
          notice: "A record of votes checkpoints for each account, by index",
        },
        "delegate(address)": {
          notice: "Delegate votes from `msg.sender` to `delegatee`",
        },
        "delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)": {
          notice: "Delegates votes from signatory to `delegatee`",
        },
        "delegates(address)": {
          notice: "Delegate votes from `msg.sender` to `delegatee`",
        },
        "getCurrentVotes(address)": {
          notice: "Gets the current votes balance for `account`",
        },
        "getPriorVotes(address,uint256)": {
          notice:
            "Determine the prior number of votes for an account as of a block number",
        },
        "mint(address,uint256)": {
          notice:
            "Creates `_amount` token to `_to`. Must only be called by the owner (MasterChef).",
        },
        "nonces(address)": {
          notice: "A record of states for signing / validating signatures",
        },
        "numCheckpoints(address)": {
          notice: "The number of checkpoints for each account",
        },
      },
      version: 1,
    },
  },
  settings: {
    compilationTarget: { "browser/JusToken.sol": "JUSToken" },
    evmVersion: "istanbul",
    libraries: {},
    metadata: { bytecodeHash: "ipfs" },
    optimizer: { enabled: false, runs: 200 },
    remappings: [],
  },
  sources: {
    "browser/JusToken.sol": {
      keccak256:
        "0x7b296c7cf5a0ec404506b7f89f174fd8a2db373fad276ea454eedb3725327e68",
      license: "MIT",
      urls: [
        "bzz-raw://d7353e6703c30d499cdb85d3ec44357ef0437a961686b1307b1e379198779b37",
        "dweb:/ipfs/QmfQTnsegs88ghWFUrX322wMMaDm3NWdRTpDr9kswRTV79",
      ],
    },
  },
  version: 1,
};

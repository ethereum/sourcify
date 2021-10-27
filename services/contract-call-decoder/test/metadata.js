export const metadata1 = {
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

// contracts/full_match/4/0x23321A5d2e27f1Cb7E0441047c1CfE4f561656A7/metadata.json
export const metadata2 = {
  compiler: { version: "0.5.17+commit.d19bba13" },
  language: "Solidity",
  output: {
    abi: [
      {
        inputs: [
          { internalType: "uint256", name: "_initialAmount", type: "uint256" },
          { internalType: "string", name: "_tokenName", type: "string" },
          { internalType: "uint8", name: "_decimalUnits", type: "uint8" },
          { internalType: "string", name: "_tokenSymbol", type: "string" },
        ],
        payable: false,
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "address",
            name: "_owner",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "_spender",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "_value",
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
            name: "_from",
            type: "address",
          },
          {
            indexed: true,
            internalType: "address",
            name: "_to",
            type: "address",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "_value",
            type: "uint256",
          },
        ],
        name: "Transfer",
        type: "event",
      },
      {
        constant: true,
        inputs: [
          { internalType: "address", name: "_owner", type: "address" },
          { internalType: "address", name: "_spender", type: "address" },
        ],
        name: "allowance",
        outputs: [
          { internalType: "uint256", name: "remaining", type: "uint256" },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [
          { internalType: "address", name: "", type: "address" },
          { internalType: "address", name: "", type: "address" },
        ],
        name: "allowed",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "_spender", type: "address" },
          { internalType: "uint256", name: "_value", type: "uint256" },
        ],
        name: "approve",
        outputs: [{ internalType: "bool", name: "success", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "_owner", type: "address" }],
        name: "balanceOf",
        outputs: [
          { internalType: "uint256", name: "balance", type: "uint256" },
        ],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "balances",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "decimals",
        outputs: [{ internalType: "uint8", name: "", type: "uint8" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "name",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "symbol",
        outputs: [{ internalType: "string", name: "", type: "string" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: true,
        inputs: [],
        name: "totalSupply",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        payable: false,
        stateMutability: "view",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "_to", type: "address" },
          { internalType: "uint256", name: "_value", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ internalType: "bool", name: "success", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        constant: false,
        inputs: [
          { internalType: "address", name: "_from", type: "address" },
          { internalType: "address", name: "_to", type: "address" },
          { internalType: "uint256", name: "_value", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ internalType: "bool", name: "success", type: "bool" }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    devdoc: { methods: {} },
    userdoc: { methods: {} },
  },
  settings: {
    compilationTarget: { "browser/ERC20.sol": "ERC20" },
    evmVersion: "istanbul",
    libraries: {},
    optimizer: { enabled: false, runs: 200 },
    remappings: [],
  },
  sources: {
    "browser/ERC20.sol": {
      keccak256:
        "0xc970bcfd500d83df7e0b5d36cf05f808dcac6accd4365a8c2747e94fe266ef1c",
      urls: [
        "bzz-raw://f68384ac7c43e5da3221e63fd60efac759e90db5b10a0844420083286ee194ec",
        "dweb:/ipfs/QmXavYVDkuWYcge9MrwYRBFxLX6gE3QEdM5cN7zWkko1kw",
      ],
    },
    "browser/IERC20.sol": {
      keccak256:
        "0xa2b35b68fe8db01375c9b5f19b7604112b80cdce3774a180295a8eeddfce6479",
      urls: [
        "bzz-raw://c1b054370d054e2d3b56f9ac7d0cb1b52078d8cfc1490533b185b8a5570cccd9",
        "dweb:/ipfs/QmQKxV7bugvs6s4KLWXGJHMK9EJgvt4FhKJVvJSBwn6Xo5",
      ],
    },
  },
  version: 1,
};

// /contracts/full_match/4/0x1d08eB247554a3C8DDB29b7313aA8B961b5F87a6/metadata.json
export const metadata3 = {
  compiler: { version: "0.6.12+commit.27d51765" },
  language: "Solidity",
  output: {
    abi: [
      {
        inputs: [
          { internalType: "uint256", name: "initialSupply", type: "uint256" },
          { internalType: "address", name: "account", type: "address" },
        ],
        stateMutability: "nonpayable",
        type: "constructor",
      },
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
            name: "amount",
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
            name: "amount",
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
          { internalType: "address", name: "account", type: "address" },
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
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
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
        inputs: [
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "burn",
        outputs: [],
        stateMutability: "nonpayable",
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
          { internalType: "uint96", name: "votes", type: "uint96" },
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
        inputs: [{ internalType: "address", name: "", type: "address" }],
        name: "delegates",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "account", type: "address" }],
        name: "getCurrentVotes",
        outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "account", type: "address" },
          { internalType: "uint256", name: "blockNumber", type: "uint256" },
        ],
        name: "getPriorVotes",
        outputs: [{ internalType: "uint96", name: "", type: "uint96" }],
        stateMutability: "view",
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
          { internalType: "address", name: "dst", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "transfer",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "src", type: "address" },
          { internalType: "address", name: "dst", type: "address" },
          { internalType: "uint256", name: "rawAmount", type: "uint256" },
        ],
        name: "transferFrom",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
    ],
    devdoc: {
      kind: "dev",
      methods: {
        "allowance(address,address)": {
          params: {
            account: "The address of the account holding the funds",
            spender: "The address of the account spending the funds",
          },
          returns: { _0: "The number of tokens approved" },
        },
        "approve(address,uint256)": {
          details:
            "This will overwrite the approval amount for `spender`  and is subject to issues noted [here](https://eips.ethereum.org/EIPS/eip-20#approve)",
          params: {
            rawAmount:
              "The number of tokens that are approved (2^256-1 means infinite)",
            spender: "The address of the account which may transfer tokens",
          },
          returns: { _0: "Whether or not the approval succeeded" },
        },
        "balanceOf(address)": {
          params: {
            account: "The address of the account to get the balance of",
          },
          returns: { _0: "The number of tokens held" },
        },
        "burn(uint256)": {
          params: { rawAmount: "The number of tokens to burn" },
        },
        constructor: {
          params: {
            account: "The initial account to grant all the tokens",
            initialSupply: "The initial supply minted at deployment",
          },
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
        "transfer(address,uint256)": {
          params: {
            dst: "The address of the destination account",
            rawAmount: "The number of tokens to transfer",
          },
          returns: { _0: "Whether or not the transfer succeeded" },
        },
        "transferFrom(address,address,uint256)": {
          params: {
            dst: "The address of the destination account",
            rawAmount: "The number of tokens to transfer",
            src: "The address of the source account",
          },
          returns: { _0: "Whether or not the transfer succeeded" },
        },
      },
      version: 1,
    },
    userdoc: {
      events: {
        "Approval(address,address,uint256)": {
          notice: "The standard EIP-20 approval event",
        },
        "DelegateChanged(address,address,address)": {
          notice: "An event thats emitted when an account changes its delegate",
        },
        "DelegateVotesChanged(address,uint256,uint256)": {
          notice:
            "An event thats emitted when a delegate account's vote balance changes",
        },
        "Transfer(address,address,uint256)": {
          notice: "The standard EIP-20 transfer event",
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
        "allowance(address,address)": {
          notice:
            "Get the number of tokens `spender` is approved to spend on behalf of `account`",
        },
        "approve(address,uint256)": {
          notice: "Approve `spender` to transfer up to `amount` from `src`",
        },
        "balanceOf(address)": {
          notice: "Get the number of tokens held by the `account`",
        },
        "burn(uint256)": { notice: "Burn `amount` tokens" },
        "checkpoints(address,uint32)": {
          notice: "A record of votes checkpoints for each account, by index",
        },
        constructor: "Construct a new Fuel token",
        "decimals()": { notice: "EIP-20 token decimals for this token" },
        "delegate(address)": {
          notice: "Delegate votes from `msg.sender` to `delegatee`",
        },
        "delegateBySig(address,uint256,uint256,uint8,bytes32,bytes32)": {
          notice: "Delegates votes from signatory to `delegatee`",
        },
        "delegates(address)": { notice: "A record of each accounts delegate" },
        "getCurrentVotes(address)": {
          notice: "Gets the current votes balance for `account`",
        },
        "getPriorVotes(address,uint256)": {
          notice:
            "Determine the prior number of votes for an account as of a block number",
        },
        "name()": { notice: "EIP-20 token name for this token" },
        "nonces(address)": {
          notice: "A record of states for signing / validating signatures",
        },
        "numCheckpoints(address)": {
          notice: "The number of checkpoints for each account",
        },
        "symbol()": { notice: "EIP-20 token symbol for this token" },
        "totalSupply()": { notice: "Total number of tokens in circulation" },
        "transfer(address,uint256)": {
          notice: "Transfer `amount` tokens from `msg.sender` to `dst`",
        },
        "transferFrom(address,address,uint256)": {
          notice: "Transfer `amount` tokens from `src` to `dst`",
        },
      },
      version: 1,
    },
  },
  settings: {
    compilationTarget: { "contracts/LaunchPoolToken.sol": "LaunchPoolToken" },
    evmVersion: "istanbul",
    libraries: {},
    metadata: { bytecodeHash: "ipfs" },
    optimizer: { enabled: true, runs: 200 },
    remappings: [],
  },
  sources: {
    "contracts/LaunchPoolToken.sol": {
      keccak256:
        "0xefa0c61464df7f36e213c949edeea2924a98692afd74a9c64d7a37c88c80c4ea",
      urls: [
        "bzz-raw://950d10095e17f224746507143dcf6064912885d42887cd118e6967c3c3d15a29",
        "dweb:/ipfs/QmQkNi7D1zxSnkeE6KKDQN2YibYwhCw5zaCuJjQ17cthxM",
      ],
    },
  },
  version: 1,
};

// Contract 0x98977330D7B19bc260de0ADB748876e3bC030c48 in Rinkeby
export const metadata4 = {
  compiler: { version: "0.6.6+commit.6c089d02" },
  language: "Solidity",
  output: {
    abi: [
      {
        inputs: [{ internalType: "address", name: "_link", type: "address" }],
        stateMutability: "nonpayable",
        type: "constructor",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "requestId",
            type: "bytes32",
          },
        ],
        name: "CancelOracleRequest",
        type: "event",
      },
      {
        anonymous: false,
        inputs: [
          {
            indexed: true,
            internalType: "bytes32",
            name: "specId",
            type: "bytes32",
          },
          {
            indexed: false,
            internalType: "address",
            name: "requester",
            type: "address",
          },
          {
            indexed: false,
            internalType: "bytes32",
            name: "requestId",
            type: "bytes32",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "payment",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "address",
            name: "callbackAddr",
            type: "address",
          },
          {
            indexed: false,
            internalType: "bytes4",
            name: "callbackFunctionId",
            type: "bytes4",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "cancelExpiration",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "uint256",
            name: "dataVersion",
            type: "uint256",
          },
          {
            indexed: false,
            internalType: "bytes",
            name: "data",
            type: "bytes",
          },
        ],
        name: "OracleRequest",
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
        inputs: [],
        name: "EXPIRY_TIME",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "_requestId", type: "bytes32" },
          { internalType: "uint256", name: "_payment", type: "uint256" },
          { internalType: "bytes4", name: "_callbackFunc", type: "bytes4" },
          { internalType: "uint256", name: "_expiration", type: "uint256" },
        ],
        name: "cancelOracleRequest",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "bytes32", name: "_requestId", type: "bytes32" },
          { internalType: "uint256", name: "_payment", type: "uint256" },
          {
            internalType: "address",
            name: "_callbackAddress",
            type: "address",
          },
          {
            internalType: "bytes4",
            name: "_callbackFunctionId",
            type: "bytes4",
          },
          { internalType: "uint256", name: "_expiration", type: "uint256" },
          { internalType: "bytes32", name: "_data", type: "bytes32" },
        ],
        name: "fulfillOracleRequest",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [{ internalType: "address", name: "_node", type: "address" }],
        name: "getAuthorizationStatus",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "getChainlinkToken",
        outputs: [{ internalType: "address", name: "", type: "address" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [],
        name: "isOwner",
        outputs: [{ internalType: "bool", name: "", type: "bool" }],
        stateMutability: "view",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "_sender", type: "address" },
          { internalType: "uint256", name: "_amount", type: "uint256" },
          { internalType: "bytes", name: "_data", type: "bytes" },
        ],
        name: "onTokenTransfer",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [
          { internalType: "address", name: "_sender", type: "address" },
          { internalType: "uint256", name: "_payment", type: "uint256" },
          { internalType: "bytes32", name: "_specId", type: "bytes32" },
          {
            internalType: "address",
            name: "_callbackAddress",
            type: "address",
          },
          {
            internalType: "bytes4",
            name: "_callbackFunctionId",
            type: "bytes4",
          },
          { internalType: "uint256", name: "_nonce", type: "uint256" },
          { internalType: "uint256", name: "_dataVersion", type: "uint256" },
          { internalType: "bytes", name: "_data", type: "bytes" },
        ],
        name: "oracleRequest",
        outputs: [],
        stateMutability: "nonpayable",
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
        inputs: [
          { internalType: "address", name: "_node", type: "address" },
          { internalType: "bool", name: "_allowed", type: "bool" },
        ],
        name: "setFulfillmentPermission",
        outputs: [],
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
      {
        inputs: [
          { internalType: "address", name: "_recipient", type: "address" },
          { internalType: "uint256", name: "_amount", type: "uint256" },
        ],
        name: "withdraw",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function",
      },
      {
        inputs: [],
        name: "withdrawable",
        outputs: [{ internalType: "uint256", name: "", type: "uint256" }],
        stateMutability: "view",
        type: "function",
      },
    ],
    devdoc: {
      methods: {
        "cancelOracleRequest(bytes32,uint256,bytes4,uint256)": {
          details:
            "Given params must hash to a commitment stored on the contract in order for the request to be valid Emits CancelOracleRequest event.",
          params: {
            _callbackFunc: "The requester's specified callback address",
            _expiration: "The time of the expiration for the request",
            _payment: "The amount of payment given (specified in wei)",
            _requestId: "The request ID",
          },
        },
        constructor: {
          details:
            "Sets the LinkToken address for the imported LinkTokenInterface",
          params: { _link: "The address of the LINK token" },
        },
        "fulfillOracleRequest(bytes32,uint256,address,bytes4,uint256,bytes32)":
          {
            details:
              "Given params must hash back to the commitment stored from `oracleRequest`. Will call the callback address' callback function without bubbling up error checking in a `require` so that the node can get paid.",
            params: {
              _callbackAddress: "The callback address to call for fulfillment",
              _callbackFunctionId:
                "The callback function ID to use for fulfillment",
              _data: "The data to return to the consuming contract",
              _expiration:
                "The expiration that the node should respond by before the requester can cancel",
              _payment:
                "The payment amount that will be released for the oracle (specified in wei)",
              _requestId:
                "The fulfillment request ID that must match the requester's",
            },
            returns: { _0: "Status if the external call was successful" },
          },
        "getAuthorizationStatus(address)": {
          params: { _node: "The address of the Chainlink node" },
          returns: { _0: "The authorization status of the node" },
        },
        "getChainlinkToken()": {
          details:
            "This is the public implementation for chainlinkTokenAddress, which is an internal method of the ChainlinkClient contract",
        },
        "isOwner()": {
          details: "Returns true if the caller is the current owner.",
        },
        "onTokenTransfer(address,uint256,bytes)": {
          details:
            "The data payload's first 2 words will be overwritten by the `_sender` and `_amount` values to ensure correctness. Calls oracleRequest.",
          params: {
            _amount: "Amount of LINK sent (specified in wei)",
            _data: "Payload of the transaction",
            _sender: "Address of the sender",
          },
        },
        "oracleRequest(address,uint256,bytes32,address,bytes4,uint256,uint256,bytes)":
          {
            details:
              "Stores the hash of the params as the on-chain commitment for the request. Emits OracleRequest event for the Chainlink node to detect.",
            params: {
              _callbackAddress: "The callback address for the response",
              _callbackFunctionId: "The callback function ID for the response",
              _data: "The CBOR payload of the request",
              _dataVersion: "The specified data version",
              _nonce: "The nonce sent by the requester",
              _payment: "The amount of payment given (specified in wei)",
              _sender: "The sender of the request",
              _specId: "The Job Specification ID",
            },
          },
        "owner()": { details: "Returns the address of the current owner." },
        "setFulfillmentPermission(address,bool)": {
          params: {
            _allowed:
              "Bool value to determine if the node can fulfill requests",
            _node: "The address of the Chainlink node",
          },
        },
        "transferOwnership(address)": {
          details:
            "Transfers ownership of the contract to a new account (`newOwner`). Can only be called by the current owner.",
        },
        "withdraw(address,uint256)": {
          details:
            "The owner of the contract can be another wallet and does not have to be a Chainlink node",
          params: {
            _amount: "The amount to send (specified in wei)",
            _recipient: "The address to send the LINK token to",
          },
        },
        "withdrawable()": {
          details:
            "We use `ONE_FOR_CONSISTENT_GAS_COST` in place of 0 in storage",
          returns: { _0: "The amount of withdrawable LINK on the contract" },
        },
      },
      title: "The Chainlink Oracle contract",
    },
    userdoc: {
      methods: {
        "cancelOracleRequest(bytes32,uint256,bytes4,uint256)": {
          notice:
            "Allows requesters to cancel requests sent to this oracle contract. Will transfer the LINK sent for the request back to the requester's address.",
        },
        constructor: "Deploy with the address of the LINK token",
        "fulfillOracleRequest(bytes32,uint256,address,bytes4,uint256,bytes32)":
          { notice: "Called by the Chainlink node to fulfill requests" },
        "getAuthorizationStatus(address)": {
          notice:
            "Use this to check if a node is authorized for fulfilling requests",
        },
        "getChainlinkToken()": {
          notice: "Returns the address of the LINK token",
        },
        "onTokenTransfer(address,uint256,bytes)": {
          notice:
            "Called when LINK is sent to the contract via `transferAndCall`",
        },
        "oracleRequest(address,uint256,bytes32,address,bytes4,uint256,uint256,bytes)":
          { notice: "Creates the Chainlink request" },
        "setFulfillmentPermission(address,bool)": {
          notice:
            "Sets the fulfillment permission for a given node. Use `true` to allow, `false` to disallow.",
        },
        "withdraw(address,uint256)": {
          notice:
            "Allows the node operator to withdraw earned LINK to a given address",
        },
        "withdrawable()": {
          notice:
            "Displays the amount of LINK that is available for the node operator to withdraw",
        },
      },
      notice:
        "Node operators can deploy this contract to fulfill requests sent to them",
    },
  },
  settings: {
    compilationTarget: {
      "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/Oracle.sol":
        "Oracle",
    },
    evmVersion: "istanbul",
    libraries: {},
    metadata: { bytecodeHash: "ipfs" },
    optimizer: { enabled: false, runs: 200 },
    remappings: [],
  },
  sources: {
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/LinkTokenReceiver.sol":
      {
        keccak256:
          "0xcbde7153731a1cd229fbef4dcbb0b5a7a3ff4782bca40cbc12f836c39e054769",
        urls: [
          "bzz-raw://83a7d0e4f1704c3b5474eb98342fbeee00782232d797f4446d7413463d17e58c",
          "dweb:/ipfs/QmTWtHy88hXLaX1K3EzuEN11F2aAT3G2QjL2WnDwPg7Mqa",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/Oracle.sol":
      {
        keccak256:
          "0x359a242174d047abdef2cc3618af11417697fd71bf4263915394749b7d2cfa0a",
        urls: [
          "bzz-raw://bb0251e0d1719b7b8e616d19fb2435307258a0c01da806db4e6ba329b194b40c",
          "dweb:/ipfs/QmNRTr72nQHQFL8A1oWe2WVE7yPVwQ4ACfAsMarUZ7pw9u",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/interfaces/ChainlinkRequestInterface.sol":
      {
        keccak256:
          "0xe513c0f60edf13da7d82625489cf2008c7b66170f3b1ed1606b84c73f95b17ad",
        urls: [
          "bzz-raw://78e083ef252b80bb63a5aa126bc7283cd9b88767dfdf0190d46802bc32756ecf",
          "dweb:/ipfs/QmdTyEQwX5ecoXR1rBh8DLDJpCYVDM85JjjR2sEJdE9wAA",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/interfaces/LinkTokenInterface.sol":
      {
        keccak256:
          "0xe245a7be950c94d87bb775ae9ee9fbd693fbe2987778e6ce0b04605ea44b7b68",
        urls: [
          "bzz-raw://bd2c3165d949fc66fe407b96eb3dc2092c7e800f4c073b411bf7b96de3e156c9",
          "dweb:/ipfs/QmcfJhR1Np4GsLWnww2Duqks2wEzYk8VDTvCAYy7MisG1r",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/interfaces/OracleInterface.sol":
      {
        keccak256:
          "0xd6a2eb19d73207e6e571208a19604fc3be880dbf317678ecd6b80e984d9a80d5",
        urls: [
          "bzz-raw://c220a59b929b622d3c70e869c6baa2e991746b017e31086c1975e6d43405b87d",
          "dweb:/ipfs/QmSchVZTRTL1snH1DnKF7ABCkL67hHEPqCDUKYztBnDx7D",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/interfaces/WithdrawalInterface.sol":
      {
        keccak256:
          "0xa3d3b86c791eafb1611562946ece09da4d389a51bcc518d13191750264eac715",
        urls: [
          "bzz-raw://5d749fac4831c1145750a1bdc9ed64eeeab950fd01f71701358dfe95f0ca8a7e",
          "dweb:/ipfs/QmR7TRN3U5KePYVFymScvRQEydKM6Yfawz4XaSALZuTnqn",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/vendor/Ownable.sol":
      {
        keccak256:
          "0x20a325da437d524570c833519481749e6e33018fe899dfdad66e59e1f60f6192",
        urls: [
          "bzz-raw://921b292b3621c1728852040f7ce8853a827a0498517ea12c9f576959419f019a",
          "dweb:/ipfs/QmXpqPMDshxmwfYMjcZiDNVJWecLz7ASnAQwHnmMgvxhXb",
        ],
      },
    "https://github.com/smartcontractkit/chainlink/evm-contracts/src/v0.6/vendor/SafeMathChainlink.sol":
      {
        keccak256:
          "0x105f5e9491f3d0bbdd4f1c7627eb839d69b944bfd803028a01cc083597692c1f",
        urls: [
          "bzz-raw://ec45a2748a024a947a921183d4102d5e206808588501d85ddc4f5668a009bc73",
          "dweb:/ipfs/QmRNAMpq7LdWFnJ7wWKGbUuAcURaGSS42PMxtQ4vjrHmp9",
        ],
      },
  },
  version: 1,
};

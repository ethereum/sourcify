# Get file tree

Returns repository URLs for every file in the source tree for the desired chain and address. Searches for full and partial matches.

**URL** : `/files/tree/any/:chain/:address`

**Method** : `GET`

## Responses

**Condition** : Contract is available as a full match in the repository.

**Code** : `200 OK`

**Content** : 

```json
{
    "status": "full",
    "files": [
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/metadata.json",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/_openzeppelin/contracts/GSN/Context.sol",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/_openzeppelin/contracts/access/AccessControl.sol",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/_openzeppelin/contracts/utils/Address.sol",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/_openzeppelin/contracts/utils/EnumerableSet.sol",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/home/fabijan/shardlabs/betting-app/ethereum/contracts/Bet.sol",
        "https://contractrepostaging.komputing.org/contracts/full_match/5/0x32a5d2240a60dcF7Af8EfAE6d886ec8BeD5f71bA/sources/home/fabijan/shardlabs/betting-app/ethereum/contracts/BetFactory.sol"
    ]
}
```

### OR

**Condition** : Contract is available as a partial match in the repository.

**Code** : `200 OK`

**Content** : 

```json
{
    "status": "partial",
    "files": [
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/metadata.json",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/GSN/Context.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/access/Ownable.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/math/SafeMath.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/token/ERC20/IERC20.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/token/ERC20/SafeERC20.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/_openzeppelin/contracts/utils/Address.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/contracts/SyntheticRebaseToken.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/contracts/interfaces/IERC20Nameable.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/contracts/interfaces/IMinimalUniswap.sol",
        "https://contractrepostaging.komputing.org/contracts/partial_match/1/0x2C1dcCD1EF8918d57652f0Bea499a12602456A12/sources/contracts/interfaces/IStatisticProvider.sol"
    ]
}
```

### OR

**Condition** : Contract is not available in the repository.

**Code** : `404 Not Found`

**Content** : 
```json
{
    "error": "Files have not been found!"
}
```
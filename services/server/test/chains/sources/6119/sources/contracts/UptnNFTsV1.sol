// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/Context.sol";
import "@opengsn/contracts/src/ERC2771Recipient.sol";
import "./IUPTNAddressValidator.sol";
import "./ERC4906.sol";


abstract contract Blacklistable is Context {
    event BlacklistedAdded(address indexed account);
    event BlacklistedRemoved(address indexed account);

    mapping(address => bool) _blacklisteds;

    modifier notBlacklisted() {
        require(!isBlacklisted(_msgSender()), "Blacklistable : caller is blacklisted");
        _;
    }

    function isBlacklisted(address account) public view virtual returns (bool) {
        return _blacklisteds[account];
    }

    function _addBlacklisted(address account) internal notBlacklisted virtual {
        _blacklisteds[account] = true;
        emit BlacklistedAdded(account);
    }

    function _removeBlacklisted(address account) internal notBlacklisted virtual  {
        _blacklisteds[account] = false;
        emit BlacklistedRemoved(account);
    }
}

contract UptnNFTsV1 is
            ERC721,
            ERC721Enumerable,
            ERC721URIStorage,
            Blacklistable,
            Pausable,
            AccessControl,
            ERC2771Recipient,
            ERC4906
{
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIdCounter;


    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BLACK_LIST_ADMIN_ROLE = keccak256("BLACK_LIST_ADMIN_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");

    address private _addressValidator;
    string private _baseUri;

    bool private _transferable;
    bool private _adminBurnable;
    bool private _useCount;

    constructor(
        address forwarder,
        address addressValidator,
        string memory baseUri,
        string memory name,
        string memory symbol,
        bool transferable,
        bool adminBurnable,
        bool useCount) ERC721(name, symbol)
    {
        _grantRole(DEFAULT_ADMIN_ROLE, _msgSender());
        _grantRole(PAUSER_ROLE, _msgSender());
        _grantRole(MINTER_ROLE, _msgSender());
        _grantRole(BLACK_LIST_ADMIN_ROLE, _msgSender());
        _grantRole(BURNER_ROLE, _msgSender());

        _baseUri = baseUri;
        _addressValidator = addressValidator;
        _setTrustedForwarder(forwarder);

        // _transferable, _adminBurnable, _useCount 생성자 포함
        _transferable = transferable;
        _adminBurnable = adminBurnable;
        _useCount = useCount;
    }

    function _baseURI() internal view override returns (string memory) {
        return _baseUri;
    }

    function setBaseUri(string memory baseUri) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseUri = baseUri;
    }

    function getAddressValidator() public view returns (address addressValidator){
        return _addressValidator;
    }

    function transferable() public view returns(bool) {
        return _transferable;
    }
    function adminBurnable() public view returns(bool) {
        return _adminBurnable;
    }
    function useCounter() public view returns(bool) {
        return _useCount;
    }

    function setTransferable(bool transferable) public onlyRole(DEFAULT_ADMIN_ROLE) {
        _transferable = transferable;
    }

    function disableAdminBurnable() public onlyRole(DEFAULT_ADMIN_ROLE) {
        _adminBurnable = false;
    }

//    // Init 이후 설정 변경 불가
//    function setUseCount(bool useCount) public onlyRole(DEFAULT_ADMIN_ROLE) {
//        _useCount = useCount;
//    }

    function pause() public onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() public onlyRole(PAUSER_ROLE) {
        _unpause();
    }

    function safeMint(address to, uint256 tokenId, string memory uri) public onlyRole(MINTER_ROLE) {
        require(_useCount == false, "UptnNFT : Counter should not be used in this method");
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function safeMint(address to, string memory uri) public onlyRole(MINTER_ROLE) {
        require(_useCount == true, "UptnNFT : Counter should be used in this method");
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    function mintMultipleTokens(address[] memory to, uint256[] memory tokenIds, string[] memory uris) public returns (bool) {
        require(_useCount == false, "UptnNFT : Counter should not be used in this method");
        require(to.length == tokenIds.length, "UptnNFT: TokenID input arrays must be the same length");
        require(to.length == uris.length, "UptnNFT: Uri input arrays must be the same length");

        for (uint256 i = 0; i < to.length; i++) {
            safeMint(to[i], tokenIds[i], uris[i]);
         }

        return true;
    }

    function mintMultipleTokens(address[] memory to, string[] memory uris) public returns (bool) {
        require(_useCount == true, "UptnNFT : Counter should be used in this method");
        require(to.length == uris.length, "UptnNFT: Uri input arrays must be the same length");

        for (uint256 i = 0; i < to.length; i++) {
            safeMint(to[i], uris[i]);
        }

        return true;
    }

    function setTokenURI(uint256 tokenId, string memory _tokenURI) public onlyRole(MINTER_ROLE) {
        require(bytes(_tokenURI).length > 0, "UptnNFT: URI should not be empty");

        _setTokenURI(tokenId, _tokenURI);

        emit MetadataUpdate(tokenId);
    }

    function addBlacklisted(address account) public onlyRole(BLACK_LIST_ADMIN_ROLE) {
        _addBlacklisted(account);
    }

    function removeBlacklisted(address account) public onlyRole(BLACK_LIST_ADMIN_ROLE) {
        _removeBlacklisted(account);
    }

    function _beforeTokenTransfer(address from, address to, uint256 tokenId, uint256 batchSize)
    internal
    whenNotPaused
    override(ERC721, ERC721Enumerable)
    {
        require(!isBlacklisted(from), string(abi.encodePacked("UptnNFT BlackList : account ", Strings.toHexString(from)," is blacklisted")));
        require(!isBlacklisted(to), string(abi.encodePacked("UptnNFT BlackList : account ", Strings.toHexString(to)," is blacklisted")));
        require(!IUPTNAddressValidator(_addressValidator).isBlacklist(from), string(abi.encodePacked("UptnNFT Address Validator : account ", Strings.toHexString(from)," is blacklisted")));
        require(!IUPTNAddressValidator(_addressValidator).isBlacklist(to), string(abi.encodePacked("UptnNFT Address Validator : account ", Strings.toHexString(to)," is blacklisted")));
        ERC721Enumerable._beforeTokenTransfer(from, to, tokenId, batchSize);
    }

    function burn(uint256 tokenId) public {
        if(_adminBurnable) {
            _burnByAdmin(tokenId);
        }else{
             require(ERC721._isApprovedOrOwner(_msgSender(), tokenId), "UptnNFT Burn: caller is not token owner");
            _burn(tokenId);
        }
    }

    function _burnByAdmin(uint256 tokenId) private onlyRole(BURNER_ROLE){
            _burn(tokenId);
    }

    // The following functions are overrides required by Solidity.
    function _burn(uint256 tokenId) internal override(ERC721, ERC721URIStorage) {
        ERC721URIStorage._burn(tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override (ERC721, IERC721){
        require(_transferable, "UptnNFT : Contract is not allowed transfer, check isTransfer");
        require(ERC721._isApprovedOrOwner(_msgSender(), tokenId), "UptnNFT ERC721: caller is not token owner or approved");
        ERC721._transfer(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) public override (ERC721, IERC721){
        safeTransferFrom(from, to, tokenId, "");
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    ) public override (ERC721, IERC721){
        require(_transferable, "UptnNFT : Contract is not allowed transfer, check isTransfer");
        require(ERC721._isApprovedOrOwner(_msgSender(), tokenId), "UptnNFT ERC721: caller is not token owner or approved");
        ERC721._safeTransfer(from, to, tokenId, data);
    }

    function tokenURI(uint256 tokenId)
    public
    view
    override(ERC721, ERC721URIStorage)
    returns (string memory)
    {
        return ERC721URIStorage.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
    public
    view
    override(ERC721, ERC721Enumerable, AccessControl, ERC4906, ERC721URIStorage)
    returns (bool)
    {
        return
        ERC721Enumerable.supportsInterface(interfaceId) ||
        AccessControl.supportsInterface(interfaceId) ||
        ERC4906.supportsInterface(interfaceId);
    }

    function _msgSender() internal view  override(Context, ERC2771Recipient) returns (address) {
        return ERC2771Recipient._msgSender();
    }

    function _msgData() internal view  override(Context, ERC2771Recipient) returns (bytes calldata ) {
        return ERC2771Recipient._msgData();
    }
}

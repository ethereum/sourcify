import Web3 from 'web3';
import * as bunyan from 'bunyan';
import { Match, InputData, getSupportedChains, getFullnodeChains, Logger, IFileService, FileService, StringMap, cborDecode, CheckedContract, MatchQuality, Chain } from '@ethereum-sourcify/core';
import { RecompilationResult, getBytecode, recompile, getBytecodeWithoutMetadata as trimMetadata, checkEndpoint } from '../utils';
import fetch from 'node-fetch';
import { StatusCodes } from 'http-status-codes';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multihashes: any = require('multihashes');

export interface InjectorConfig {
    infuraPID?: string,
    silent?: boolean,
    log?: bunyan,
    offline?: boolean,
    repositoryPath?: string,
    fileService?: IFileService
}

class InjectorChain {
    web3: Web3;
    rpc: string[];
    name: string;
    contractFetchAddress: string;
    txRegex: string;
    constructor(chain: Chain) {
        this.rpc = chain.rpc;
        this.name = chain.name;
        this.contractFetchAddress = chain.contractFetchAddress;
        this.txRegex = chain.txRegex;
    }
}

interface InjectorChainMap {
    [id: string]: InjectorChain
}

export class Injector {
    private log: bunyan;
    private chains: InjectorChainMap;
    private infuraPID: string;
    private offline: boolean;
    public fileService: IFileService;
    repositoryPath: string;

    /**
     * Constructor
     * @param {InjectorConfig = {}} config
     */
    private constructor(config: InjectorConfig = {}) {
        this.chains = {};
        this.infuraPID = config.infuraPID;
        this.offline = config.offline || false;
        this.repositoryPath = config.repositoryPath;
        this.log = config.log || Logger("Injector");

        this.fileService = config.fileService || new FileService(this.repositoryPath, this.log);
    }

    /**
     * Creates an instance of Injector. Waits for chains to initialize.
     * Await this method to work with an instance that has all chains initialized.
     * @param config 
     */
    public static async createAsync(config: InjectorConfig = {}): Promise<Injector> {
        const instance = new Injector(config);
        if (!instance.offline) {
            await instance.initChains();
        }
        return instance;
    }

    /**
     * Creates an instance of Injector. Does not initialize chains.
     * @param config 
     */
    public static createOffline(config: InjectorConfig = {}): Injector {
        return new Injector(config);
    }

    /**
     * Instantiates a web3 provider for all public ethereum networks via Infura or regular node.
     * If environment variable TESTING is set to true, localhost:8545 is also available.
     */
    private async initChains() {
        if (this.infuraPID) {
            this.log.info({loc: "[INIT_CHAINS]"}, "started checking infuraPID");
            await checkEndpoint(this.infuraPID).catch((err) => {
                this.log.warn({ infuraID: this.infuraPID }, err.message);
            })
            this.log.info({loc: "[INIT_CHAINS]"}, "finished checking infuraPID");
        }

        const chainsData = this.infuraPID ? getSupportedChains() : getFullnodeChains();

        for (const chain of chainsData) {
            this.chains[chain.chainId] = new InjectorChain(chain);

            if (this.infuraPID) {
                const web3 = chain.rpc[0].replace('${INFURA_API_KEY}', this.infuraPID);
                this.chains[chain.chainId].web3 = new Web3(web3);
            } else {
                const web3 = chain.fullnode.dappnode;
                this.chains[chain.chainId].web3 = new Web3(web3)
                await checkEndpoint(web3).catch(() => {
                    this.log.warn({ endpoint: web3 }, `Invalid endpoint for chain ${chain.name}`);
                })
            }
        }

        const numberOfChains = Object.keys(this.chains).length;
        this.log.info({loc: "[INIT_CHAINS]", numberOfChains}, "Finished loading chains");
    }

    /**
     * Searches a set of addresses for the one whose deployedBytecode
     * matches a given bytecode string
     * @param {String[]}          addresses
     * @param {string}      deployedBytecode
     */
    private async matchBytecodeToAddress(
        chain: string,
        addresses: string[] = [],
        compiledRuntimeBytecode: string,
        compiledCreationBytecode: string,
    ): Promise<Match> {
        let match: Match = { address: null, status: null };
        const chainName = this.chains[chain].name || "The chain";

        for (let address of addresses) {
            address = Web3.utils.toChecksumAddress(address)

            let deployedBytecode: string | null = null;
            try {
                this.log.info(
                    {
                        loc: '[MATCH]',
                        chain: chain,
                        address: address
                    },
                    `Retrieving contract bytecode address`
                );
                deployedBytecode = await getBytecode(this.chains[chain].web3, address);
            } catch (e) { /* ignore */ }

            let status;
            try {
                status = await this.compareBytecodes(
                    deployedBytecode, null, compiledRuntimeBytecode, compiledCreationBytecode, chain, address
                );
            } catch (err) {
                if (addresses.length === 1) {
                    match.message = "There were problems during contract verification.";
                }
            }

            if (status) {
                match = { address, status };
                break;
            } else if (addresses.length === 1 && !match.message) {
                if (!deployedBytecode) {
                    match.message = `${chainName} is temporarily unavailable.`
                } else if (deployedBytecode === "0x") {
                    match.message = `${chainName} does not have a contract deployed at ${address}.`;
                } else {
                    match.message = "The deployed and recompiled bytecode don't match.";
                }
            }
        }

        return match;
    }

    /**
     * Returns a string description of how closely two bytecodes match. Bytecodes
     * that match in all respects apart from their metadata hashes are 'partial'.
     * Bytecodes that don't match are `null`.
     * @param  {string} deployedBytecode
     * @param  {string} creationData
     * @param  {string} compiledRuntimeBytecode
     * @param  {string} compiledCreationBytecode
     * @param  {string} chain chainId of the chain where contract is being checked
     * @param  {string} address contract address
     * @return {string | null}  match description ('perfect'|'partial'|null)
     */
    private async compareBytecodes(
        deployedBytecode: string | null,
        creationData: string,
        compiledRuntimeBytecode: string,
        compiledCreationBytecode: string,
        chain: string,
        address: string
    ): Promise<'perfect' | 'partial' | null> {

        if (deployedBytecode && deployedBytecode.length > 2) {
            if (deployedBytecode === compiledRuntimeBytecode) {
                return 'perfect';
            }

            const trimmedDeployedBytecode = trimMetadata(deployedBytecode);
            const trimmedCompiledRuntimeBytecode = trimMetadata(compiledRuntimeBytecode);
            if (trimmedDeployedBytecode === trimmedCompiledRuntimeBytecode) {
                return 'partial';
            }

            if (trimmedDeployedBytecode.length === trimmedCompiledRuntimeBytecode.length) {
                creationData = creationData || await this.getCreationData(chain, address);
                if (creationData) {
                    compiledCreationBytecode = compiledCreationBytecode.replace(/^0x/, "");
    
                    if (creationData.includes(compiledCreationBytecode)) {
                        // The reason why this uses `includes` instead of `===` is that
                        // creationData may contain constructor arguments at the end part.
                        // Also, apparently some chains may prepend data to creationBytecode.
                        return 'perfect';
                    }
                    
                    const trimmedCompiledCreationBytecode = trimMetadata(compiledCreationBytecode);
                    if (creationData.includes(trimmedCompiledCreationBytecode)) {
                        return 'partial';
                    }
                }
            }
        }

        return null;
    }

    /**
     * Returns the `creationData` from the transaction that created the contract at the provided chain and address.
     * @param chain 
     * @param contractAddress 
     * @returns `creationData` if found, `null` otherwise
     */
    private async getCreationData(chain: string, contractAddress: string): Promise<string> {
        const loc = "[FETCH_CREATION_DATA]";
        let fetchAddress = this.chains[chain].contractFetchAddress;
        const txRegex = this.chains[chain].txRegex;

        if (fetchAddress) {
            fetchAddress = fetchAddress.replace("${ADDRESS}", contractAddress);
            this.log.info({ loc, chain, contractAddress, fetchAddress });

            const res = await fetch(fetchAddress);
            const buffer = await res.buffer();
            const page = buffer.toString();
            if (res.status === StatusCodes.OK) {
                const matched = page.match(txRegex);
                if (matched && matched[1]) {
                    const txHash = matched[1];
                    const web3 = this.chains[chain].web3;
                    const tx = await web3.eth.getTransaction(txHash);
                    return tx.input;
                }
            } else {
                this.log.error({ loc, chain, contractAddress, page });
            }
        }

        const err = "Cannot fetch creation data";
        this.log.error({ loc, chain, contractAddress, err });
        throw new Error(err);
    }

    /**
     * Throws if addresses array contains a null value (express) or is length 0
     * @param {string[] = []} addresses param (submitted to injector)
     */
    private validateAddresses(addresses: string[] = []) {
        const err = new Error("Missing address for submitted sources/metadata");

        if (!addresses.length) {
            throw err;
        }

        for (const address of addresses) {
            if (address == null) throw err;
        }
    }

    /**
     * Throws if `chain` is falsy or wrong type
     * @param {string} chain param (submitted to injector)
     */
    private validateChain(chain: string) {
        if (!chain || typeof chain !== 'string') {
            throw new Error("Missing chain name for submitted sources/metadata");
        }
    }

    /**
     * Used by the front-end. Accepts a set of source files and a metadata string,
     * recompiles / validates them and stores them in the repository by chain/address
     * and by swarm | ipfs hash.
     * @param  {string}            repository repository root (ex: 'repository')
     * @param  {string}            chain      chain name (ex: 'ropsten')
     * @param  {string}            address    contract address
     * @param  {string[]}          files
     * @return {Promise<object>}              address & status of successfully verified contract
     */
    public async inject(inputData: InputData): Promise<Match> {
        const { chain, addresses, contract } = inputData;
        this.validateAddresses(addresses);
        this.validateChain(chain);

        let match: Match;

        if (!CheckedContract.isValid(contract)) {
            await CheckedContract.fetchMissing(contract, this.log);
        }

        const compilationResult = await recompile(contract.metadata, contract.solidity, this.log)

        // When injector is called by monitor, the bytecode has already been
        // obtained for address and we only need to compare w/ compilation result.
        if (inputData.bytecode) {
            if (addresses.length !== 1) {
                const err = "Injector cannot work with multiple addresses if bytecode is provided";
                this.log.error({ loc: "[INJECTOR]", addresses, err });
                throw new Error(err);
            }
            const address = addresses[0];

            const status = await this.compareBytecodes(
                inputData.bytecode,
                inputData.creationData,
                compilationResult.deployedBytecode,
                compilationResult.bytecode,
                chain,
                address
            );
            const checkedAddress = Web3.utils.toChecksumAddress(address);
            match = { address: checkedAddress, status };

        // For other cases, we need to retrieve the code for specified address
        // from the chain.
        } else {
            match = await this.matchBytecodeToAddress(
                chain,
                addresses,
                compilationResult.deployedBytecode,
                compilationResult.bytecode
            );
        }

        // Since the bytecode matches, we can be sure that we got the right
        // metadata file (up to json formatting) and exactly the right sources.
        // Now we can store the re-compiled and correctly formatted metadata file
        // and the sources.
        if (match.address && match.status) {
            const matchQuality = this.statusToMatchQuality(match.status);
            this.storeSources(matchQuality, chain, match.address, contract.solidity);
            this.storeMetadata(matchQuality, chain, match.address, compilationResult);

        } else {
            const message = match.message || "Could not match the deployed and recompiled bytecode."
            const err = new Error(`Contract name: ${contract.name}. ${message}`);

            this.log.error({
                loc: '[INJECT]', chain, addresses, err
            });

            throw new Error(err.message);
        }

        return match;
    }

    /**
     * This method exists because many different people have contributed to this code, which has led to the
     * lack of unanimous nomenclature
     * @param status 
     * @returns {MatchQuality} matchQuality
     */
    private statusToMatchQuality(status: string): MatchQuality {
        if (status === "perfect") return "full";
        if (status === "partial") return status;
    }

    private sanitizePath(originalPath: string): string {
        return originalPath
            .replace(/[^a-z0-9_./-]/gim, "_")
            .replace(/(^|\/)[.]+($|\/)/, '_');
    }

    /**
     * Stores the metadata from compilationResult to the swarm | ipfs subrepo. The exact storage path depends
     * on the swarm | ipfs address extracted from compilationResult.deployedByteode.
     * 
     * @param chain used only for logging
     * @param address used only for loggin
     * @param compilationResult should contain deployedBytecode and metadata
     */
    private storeMetadata(matchQuality: MatchQuality, chain: string, address: string, compilationResult: RecompilationResult) {
        this.fileService.save({
            matchQuality,
            chain,
            address,
            fileName: "metadata.json"
        },
            compilationResult.metadata
        );

        if (matchQuality === "full") {
            let metadataPath: string;
            const bytes = Web3.utils.hexToBytes(compilationResult.deployedBytecode);
            const cborData = cborDecode(bytes);

            if (cborData['bzzr0']) {
                metadataPath = `/swarm/bzzr0/${Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)}`;
            } else if (cborData['bzzr1']) {
                metadataPath = `/swarm/bzzr1/${Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)}`;
            } else if (cborData['ipfs']) {
                metadataPath = `/ipfs/${multihashes.toB58String(cborData['ipfs'])}`;
            } else {
                const err = new Error(
                    "Re-compilation successful, but could not find reference to metadata file in cbor data."
                );

                this.log.error({
                    loc: '[INJECTOR:STORE_METADATA]', address, chain, err
                });

                throw err;
            }

            this.fileService.save(metadataPath, compilationResult.metadata);
        }
    }

    /**
     * Writes verified sources to repository by address under the "partial_match" folder.
     * This method used when recompilation bytecode matches deployed *except* for their
     * metadata components.
     * @param {string}              chain             chain name (ex: 'ropsten')
     * @param {string}              address           contract address
     * @param {StringMap}           sources           'rearranged' sources
     * @param {MatchQuality}        matchQuality
     */
    private storeSources(matchQuality: MatchQuality, chain: string, address: string, sources: StringMap) {
        for (const sourcePath in sources) {
            this.fileService.save({
                matchQuality,
                chain,
                address,
                source: true,
                fileName: this.sanitizePath(sourcePath)
            },
                sources[sourcePath]
            );
        }
    }
}


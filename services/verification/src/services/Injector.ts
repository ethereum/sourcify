import Web3 from 'web3';
import * as bunyan from 'bunyan';
import pg from 'pg';
import { Match, InputData, getSupportedChains, getFullnodeChains, Logger, IFileService, FileService, StringMap, cborDecode, CheckedContract, MatchQuality, Chain, Status } from '@ethereum-sourcify/core';
import { RecompilationResult, getBytecode, recompile, getBytecodeWithoutMetadata as trimMetadata, checkEndpoint, getCreationDataFromArchive, getCreationDataByScraping, getCreationDataFromGraphQL, getCreationDataTelos } from '../utils';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const multihashes: any = require('multihashes');

export interface InjectorConfig {
    alchemyPID?: string,
    silent?: boolean,
    log?: bunyan,
    offline?: boolean,
    repositoryPath?: string,
    fileService?: IFileService,
    web3timeout?: number
}

class InjectorChain {
    web3array: Web3[];
    rpc: string[];
    name: string;
    contractFetchAddress: string;
    graphQLFetchAddress: string;
    txRegex: string;
    archiveWeb3: Web3;
    isTelos: boolean;

    constructor(chain: Chain) {
        this.web3array = [];
        this.rpc = chain.rpc;
        this.name = chain.name;
        this.contractFetchAddress = chain.contractFetchAddress;
        this.graphQLFetchAddress = chain.graphQLFetchAddress;
        this.txRegex = chain.txRegex;
        this.archiveWeb3 = chain.archiveWeb3;
    }
}

interface InjectorChainMap {
    [id: string]: InjectorChain
}

class LoggerWrapper {
    logger: bunyan;
    logId: string;

    constructor(logger: bunyan) {
        this.logger = logger;
        this.logId = Math.random().toString().slice(2);
    }

    info(obj: any, ...params: any[]): void {
        return this.logger.info(Object.assign(obj, { verificationId: this.logId }), ...params);
    }

    error(obj: any, ...params: any[]): void {
        return this.logger.error(Object.assign(obj, { verificationId: this.logId }), ...params);
    }
}

/**
 * Represents an adapted DB row.
 */
class DeploymentData {
    chain: string;
    address: string;
    creationData: string;

    constructor(chain: string, address: string, creationData?: string) {
        this.chain = chain;
        this.address = address;
        this.creationData = creationData;
    }

    /**
     * Compare by chain and address
     * 
     * @param other another instance of DeploymentData
     * @returns `true` if other has strictly equal chain and address; `false` otherwise
     */
    equalsChainAddress(other: DeploymentData): boolean {
        return this.chain === other.chain && this.address === other.address;
    }
}

export class Injector {
    private log: bunyan;
    private chains: InjectorChainMap;
    private alchemyPID: string;
    private offline: boolean;
    public fileService: IFileService;
    private web3timeout: number;
    repositoryPath: string;
    private dbClient: pg.Client;

    /**
     * Constructor
     * @param {InjectorConfig = {}} config
     */
    private constructor(config: InjectorConfig = {}) {
        this.chains = {};
        this.alchemyPID = config.alchemyPID;
        this.offline = config.offline || false;
        this.repositoryPath = config.repositoryPath;
        this.log = config.log || Logger("Injector");
        this.web3timeout = config.web3timeout || 3000;

        if (process.env.TESTING !== "true") {
            this.dbClient = new pg.Client({
                host: process.env.POSTGRES_HOST,
                port: parseInt(process.env.POSTGRES_PORT),
                user: process.env.POSTGRES_USER,
                database: process.env.POSTGRES_DB,
                password: process.env.POSTGRES_PASSWORD,
                connectionTimeoutMillis: parseInt(process.env.POSTGRES_TIMEOUT) || 10_000
            });
        }

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

        if (instance.dbClient) {
            instance.log.info({loc: "[INJECTOR:CREATE]"}, "Connecting to DB");
            try {
                await instance.dbClient.connect();
                instance.log.info({loc: "[INJECTOR:CREATE]"}, "Connected to DB");
            } catch (err) {
                instance.log.error({loc: "[INJECTOR:CREATE]", err}, "Failed connecting to DB");
                await instance.dbClient.end();
                delete instance.dbClient;
            }
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
     * Instantiates a web3 provider for all public ethereum networks via Infura/Alchemy or regular node.
     * If environment variable TESTING is set to true, localhost:8545 is also available.
     */
    private async initChains() {
        if (this.alchemyPID) {
            this.log.info({loc: "[INIT_CHAINS]"}, "started checking providerPID");
            await checkEndpoint(this.alchemyPID).catch((err: Error) => {
                this.log.warn({ providerID: this.alchemyPID }, err.message);
            })
            this.log.info({loc: "[INIT_CHAINS]"}, "finished checking providerPID");
        }

        const chainsData = this.alchemyPID ? getSupportedChains() : getFullnodeChains();

        for (const chain of chainsData) {
            this.chains[chain.chainId] = new InjectorChain(chain);

            if (this.alchemyPID) {
                this.chains[chain.chainId].web3array = chain.rpc.map((rpcURL: string) => {
                    const opts = { timeout: this.web3timeout };
                    return new Web3(new Web3.providers.HttpProvider(rpcURL, opts));
                });
            } else {
                const web3 = chain.fullnode.dappnode;
                this.chains[chain.chainId].web3array = [new Web3(web3)];
                await checkEndpoint(web3).catch(() => {
                    this.log.warn({ endpoint: web3 }, `Invalid endpoint for chain ${chain.name}`);
                })
            }
        }

        const numberOfChains = Object.keys(this.chains).length;
        this.log.info({loc: "[INIT_CHAINS]", numberOfChains}, "Finished loading chains");
    }

    /**
     * Searches the `deploymentDatas` to find matches with `recompiled`.
     * @param {DeploymentData[]}    deploymentDatas
     * @param {RecompilationResult} recompiled
     */
    private async matchBytecodeToAddress(
        deploymentDatas: DeploymentData[],
        recompiled: RecompilationResult
    ): Promise<Match[]> {
        const matches: Match[] = [];

        for (const deploymentData of deploymentDatas) {
            const chain = deploymentData.chain;
            const chainName = this.chains[chain].name || "The chain";
            const address = Web3.utils.toChecksumAddress(deploymentData.address);
            const creationData = deploymentData.creationData;

            let match: Match = { chain, address, status: null };

            let deployedBytecode: string = null;
            try {
                this.log.info(
                    { loc: '[MATCH]', chain, address },
                    `Retrieving contract bytecode address`
                );
                deployedBytecode = await getBytecode(this.chains[chain].web3array, address);
            } catch (e) { /* ignore */ }

            try {
                match = await this.compareBytecodes(
                    deployedBytecode, creationData, recompiled, chain, address
                );
            } catch (err) {
                match.message = "There were problems during contract verification. Please try again in a minute.";
            }

            matches.push(match);

            if (match.status) {
                break;
            } else if (deploymentDatas.length === 1 && !match.message) {
                if (!deployedBytecode) {
                    match.message = `${chainName} is temporarily unavailable.`
                } else if (deployedBytecode === "0x") {
                    match.message = `${chainName} does not have a contract deployed at ${address}.`;
                } else {
                    match.message = "The deployed and recompiled bytecode don't match.";
                }
            }
        }

        return matches;
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
     * @return {Match}  match description ('perfect'|'partial'|null) and possibly constructor args (ABI-encoded) and library links
     */
    private async compareBytecodes(
        deployedBytecode: string | null,
        creationData: string,
        recompiled: RecompilationResult,
        chain: string,
        address: string
    ): Promise<Match> {

        const match: Match = {
            address,
            status: null,
            encodedConstructorArgs: undefined,
            libraryMap: undefined,
            chain
        };

        if (deployedBytecode && deployedBytecode.length > 2) {
            const { replaced, libraryMap } = this.addLibraryAddresses(recompiled.deployedBytecode, deployedBytecode);
            recompiled.deployedBytecode = replaced;
            match.libraryMap = libraryMap;

            if (deployedBytecode === recompiled.deployedBytecode) {
                match.status = "perfect";
                return match;
            }

            const trimmedDeployedBytecode = trimMetadata(deployedBytecode);
            const trimmedCompiledRuntimeBytecode = trimMetadata(recompiled.deployedBytecode);
            if (trimmedDeployedBytecode === trimmedCompiledRuntimeBytecode) {
                match.status = "partial";
                return match;
            }

            if (trimmedDeployedBytecode.length === trimmedCompiledRuntimeBytecode.length) {
                creationData = creationData || await this.getCreationData(chain, address);

                const { replaced, libraryMap } = this.addLibraryAddresses(recompiled.creationBytecode, creationData);
                recompiled.creationBytecode = replaced;
                match.libraryMap = libraryMap;

                if (creationData) {
                    if (creationData.startsWith(recompiled.creationBytecode)) {
                        // The reason why this uses `startsWith` instead of `===` is that
                        // creationData may contain constructor arguments at the end part.
                        const encodedConstructorArgs = this.extractEncodedConstructorArgs(creationData, recompiled.creationBytecode);
                        match.status = "perfect";
                        match.encodedConstructorArgs = encodedConstructorArgs;
                        return match;
                    }

                    const trimmedCompiledCreationBytecode = trimMetadata(recompiled.creationBytecode);

                    if (creationData.startsWith(trimmedCompiledCreationBytecode)) {
                        match.status = "partial";
                        return match;
                    }
                }
            }
        }

        return match;
    }

    private addLibraryAddresses(template: string, real: string): {
        replaced: string,
        libraryMap: StringMap
    } {
        const PLACEHOLDER_START = "__$";
        const PLACEHOLDER_LENGTH = 40;

        const libraryMap: StringMap = {};

        let index = template.indexOf(PLACEHOLDER_START);
        for (; index !== -1; index = template.indexOf(PLACEHOLDER_START)) {
            const placeholder = template.slice(index, index + PLACEHOLDER_LENGTH);
            const address = real.slice(index, index + PLACEHOLDER_LENGTH);
            libraryMap[placeholder] = address;
            const regexCompatiblePlaceholder = placeholder.replace("__$", "__\\$").replace("$__", "\\$__");
            const regex = RegExp(regexCompatiblePlaceholder, "g");
            template = template.replace(regex, address);
        }

        return {
            replaced: template,
            libraryMap
        };
    }

    /**
     * Returns the `creationData` from the transaction that created the contract at the provided chain and address.
     * @param chain 
     * @param contractAddress 
     * @returns `creationData` if found, `null` otherwise
     */
    private async getCreationData(chain: string, contractAddress: string): Promise<string> {
        const loc = "[GET_CREATION_DATA]";
        let txFetchAddress = this.chains[chain].contractFetchAddress;
        const txRegex = this.chains[chain].txRegex;

        if (txFetchAddress && txRegex) { // fetch from a block explorer and extract by regex
            txFetchAddress = txFetchAddress.replace("${ADDRESS}", contractAddress);
            this.log.info({ loc, chain, contractAddress, fetchAddress: txFetchAddress }, "Scraping block explorer");
            for (const web3 of this.chains[chain].web3array) {
                try {
                    return await getCreationDataByScraping(txFetchAddress, txRegex, web3);
                } catch(err: any) {
                    this.log.error({ loc, chain, contractAddress, err: err.message }, "Scraping failed!");
                }
            }
        }

        if (txFetchAddress && this.chains[chain].isTelos) {
            txFetchAddress = txFetchAddress.replace("${ADDRESS}", contractAddress);
            for (const web3 of this.chains[chain].web3array) {
                this.log.info({ loc, chain, contractAddress, fetchAddress: txFetchAddress }, "Querying Telos API");
                try {
                    return await getCreationDataTelos(txFetchAddress, web3);
                } catch(err: any) {
                    this.log.error({ loc, chain, contractAddress, err: err.message }, "Telos API failed!");
                } 
            }
            
        }

        const graphQLFetchAddress = this.chains[chain].graphQLFetchAddress;
        if (graphQLFetchAddress) { // fetch from graphql node
            for (const web3 of this.chains[chain].web3array) {
                try {
                    return await getCreationDataFromGraphQL(graphQLFetchAddress, contractAddress, web3);
                } catch (err: any) {
                    this.log.error({ loc, chain, contractAddress, err: err.message });
                }
            }
        }

        const archiveWeb3 = this.chains[chain].archiveWeb3;
        if (archiveWeb3) { // fetch by binary search on chain history
            this.log.info({ loc, chain, contractAddress }, "Fetching archive data");
            try {
                return await getCreationDataFromArchive(contractAddress, archiveWeb3);
            } catch(err: any) {
                this.log.error({ loc, chain, contractAddress, err: err.message }, "Archive search failed!");
            }
        }

        const err = "Cannot fetch creation data";
        this.log.error({ loc, chain, contractAddress, err });
        throw new Error(err);
    }

    private extractEncodedConstructorArgs(creationData: string, compiledCreationBytecode: string) {
        const startIndex = creationData.indexOf(compiledCreationBytecode);
        const slice = creationData.slice(startIndex + compiledCreationBytecode.length);
        return slice ? ("0x" + slice) : "";
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
    public async inject(inputData: InputData): Promise<Match[]> {
        const { chainAddressPairs, contract } = inputData;
        const userDeploymentDatas: DeploymentData[] = chainAddressPairs.map(pair => {
            return new DeploymentData(pair.chain, pair.address);
        });

        const matches: Match[] = [];
        const wrappedLogger = new LoggerWrapper(this.log);

        if (!CheckedContract.isValid(contract)) {
            await CheckedContract.fetchMissing(contract, wrappedLogger);
        }

        const compilationResult = await recompile(contract.metadata, contract.solidity, wrappedLogger);

        // When injector is called by monitor, the bytecode has already been
        // obtained for address and we only need to compare w/ compilation result.
        if (inputData.bytecode) {
            if (chainAddressPairs.length !== 1) {
                const err = "Injector cannot work with multiple addresses if bytecode is provided";
                this.log.error({ loc: "[INJECTOR]", chainAddressPairs, err });
                throw new Error(err);
            }

            const chain = chainAddressPairs[0].chain;
            const address = Web3.utils.toChecksumAddress(chainAddressPairs[0].address);

            const match = await this.compareBytecodes(
                inputData.bytecode,
                inputData.creationData,
                compilationResult,
                chain,
                address
            );
            matches.push(match);

        // For other cases, we need to retrieve the code for specified address
        // from the chain.
        } else {
            const fetchedDeploymentDatas = await this.fetchByBytecode(compilationResult.creationBytecode);

            for (const fetchedDeploymentData of fetchedDeploymentDatas) {
                const encodedConstructorArgs = this.extractEncodedConstructorArgs(
                    fetchedDeploymentData.creationData, compilationResult.creationBytecode
                );

                const { libraryMap } = this.addLibraryAddresses(
                    compilationResult.creationBytecode, fetchedDeploymentData.creationData
                );

                matches.push({
                    chain: fetchedDeploymentData.chain,
                    address: fetchedDeploymentData.address,
                    status: "perfect",
                    encodedConstructorArgs,
                    libraryMap
                });
            }

            const { finalDeploymentDatas, incompleteDeploymentDatas } = this.getFinalDeploymentDatas(userDeploymentDatas, fetchedDeploymentDatas);

            const pendingMatches = await this.matchBytecodeToAddress(
                finalDeploymentDatas,
                compilationResult
            );
            matches.push(...pendingMatches);

            for (const incompleteDeploymentData of incompleteDeploymentDatas) {
                matches.push({
                    address: incompleteDeploymentData.address,
                    chain: incompleteDeploymentData.chain,
                    status: undefined
                });
            }
        }

        // Since the bytecode matches, we can be sure that we got the right
        // metadata file (up to json formatting) and exactly the right sources.
        // Now we can store the re-compiled and correctly formatted metadata file
        // and the sources.

        if (!matches.length) {
            const err = new Error(`No matches found for ${contract.name}`);
            this.log.error({
                loc: '[INJECT]',
                contract: contract.name,
                err: err.message
            });
            throw err;
        }

        for (const match of matches) {
            if (match.address && match.status) {
                const metadataPath = this.getMetadataPathFromCborEncoded(compilationResult, match.address, match.chain);
                if (metadataPath) {
                    this.fileService.save(metadataPath, compilationResult.metadata);
                    this.fileService.deletePartial(match.chain, match.address);
                } else {
                    match.status = "partial";
                }

                const matchQuality = this.statusToMatchQuality(match.status);
                this.storeSources(matchQuality, match.chain, match.address, contract.solidity);
                this.storeMetadata(matchQuality, match.chain, match.address, compilationResult);

                if (match.encodedConstructorArgs && match.encodedConstructorArgs.length) {
                    this.storeConstructorArgs(matchQuality, match.chain, match.address, match.encodedConstructorArgs);
                }

                if (match.libraryMap && Object.keys(match.libraryMap).length) {
                    this.storeLibraryMap(matchQuality, match.chain, match.address, match.libraryMap);
                }

            } else {
                const message = match.message || "Could not match the deployed and recompiled bytecode."
                const err = new Error(`Contract name: ${contract.name}. ${message}`);

                this.log.error({
                    loc: '[INJECT]',
                    chain: match.chain,
                    address: match.address,
                    err: err.message
                });

                if (matches.length === 1) {
                    throw err;
                }
            }
        }

        return matches;
    }

    private async fetchByBytecode(bytecode: string): Promise<DeploymentData[]> {
        if (!this.dbClient) {
            return [];
        }

        // CREATE INDEX idx_prefix200 ON public.complete USING btree ("substring"(code, 0, 101))
        // caveat: hex_length = 2*byte_length
        // caveat: byte_length+1 to account for the initial \\x
        // caveat: division assumes an even prefixLength
        for (const prefixLength of [200]) { // descending order
            bytecode = bytecode.replace(/^0x/, "");
            const prefix = "\\x" + bytecode.slice(0, prefixLength);
            const queryResult = await this.dbClient.query(`
                SELECT chain, address, encode(code, 'hex') as hexCode from complete
                WHERE substring(code from 0 for ${prefixLength / 2 + 1}) = $1;
            `, [prefix]);

            const filtered = queryResult.rows.map(row => new DeploymentData(
                row.chain.replace("eip155:", ""),
                row.address,
                row.hexcode
            )).filter(data => data.creationData.startsWith(bytecode));

            if (filtered.length) {
                return filtered;
            }
        }

        return [];
    }

    private getFinalDeploymentDatas(
        userDeploymentDatas: DeploymentData[],
        fetchedDeploymentDatas: DeploymentData[]
    ):  {
            finalDeploymentDatas: DeploymentData[],
            incompleteDeploymentDatas: DeploymentData[]
        }
        {
        const finalDeploymentDatas: DeploymentData[] = [];
        const incompleteDeploymentDatas: DeploymentData[] = [];
        for (const userDeploymentData of userDeploymentDatas) {
            if (!userDeploymentData.chain || !userDeploymentData.address) {
                incompleteDeploymentDatas.push(userDeploymentData);
                continue;
            }

            let shouldProcess = true;
            for (const fetchedDeploymentData of fetchedDeploymentDatas) {
                if (fetchedDeploymentData.equalsChainAddress(userDeploymentData)) {
                    shouldProcess = false;
                    break;
                }
            }

            if (shouldProcess) {
                finalDeploymentDatas.push(userDeploymentData);
            }
        }

        return { finalDeploymentDatas, incompleteDeploymentDatas };
    }

    /**
     * This method exists because many different people have contributed to this code, which has led to the
     * lack of unanimous nomenclature
     * @param status 
     * @returns {MatchQuality} matchQuality
     */
    private statusToMatchQuality(status: Status): MatchQuality {
        if (status === "perfect") return "full";
        if (status === "partial") return status;
    }

    private sanitizePath(originalPath: string): string {
        return originalPath
            .replace(/[^a-z0-9_./-]/gim, "_")
            .replace(/(^|\/)[.]+($|\/)/, '_');
    }

    private getMetadataPathFromCborEncoded(compilationResult: RecompilationResult, address: string, chain: string) {
        const bytes = Web3.utils.hexToBytes(compilationResult.deployedBytecode);
        const cborData = cborDecode(bytes);

        if (cborData['bzzr0']) {
            return`/swarm/bzzr0/${Web3.utils.bytesToHex(cborData['bzzr0']).slice(2)}`;
        } else if (cborData['bzzr1']) {
            return `/swarm/bzzr1/${Web3.utils.bytesToHex(cborData['bzzr1']).slice(2)}`;
        } else if (cborData['ipfs']) {
            return `/ipfs/${multihashes.toB58String(cborData['ipfs'])}`;
        }

        this.log.error({
            loc: '[INJECTOR:GET_METADATA_PATH]',
            address,
            chain,
            err: "No metadata hash in cbor encoded data."
        });
        return null;
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
    }

    /**
     * Writes the verified sources (.sol files) to the repository.
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

    /**
     * Writes the constructor arguments to the repository.
     * @param matchQuality 
     * @param chain 
     * @param address 
     * @param encodedConstructorArgs 
     */
    private storeConstructorArgs(matchQuality: MatchQuality, chain: string, address: string, encodedConstructorArgs: string) {
        this.fileService.save({
            matchQuality,
            chain,
            address,
            source: false,
            fileName: "constructor-args.txt"
        },
            encodedConstructorArgs
        );
    }

    /**
     * Writes the map of library links (pairs of the format <placeholder:address>) to the repository.
     * @param matchQuality 
     * @param chain 
     * @param address 
     * @param libraryMap 
     */
    private storeLibraryMap(matchQuality: MatchQuality, chain: string, address: string, libraryMap: StringMap) {
        const indentationSpaces = 2;
        this.fileService.save({
            matchQuality,
            chain,
            address,
            source: false,
            fileName: "library-map.json"
        },
            JSON.stringify(libraryMap, null, indentationSpaces)
        );
    }
}

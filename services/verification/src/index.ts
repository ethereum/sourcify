const solc: any = require('solc');

import Web3 from 'web3';
import { Logger } from '../../../services/core/build/index';
import * as bunyan from 'bunyan';
import { Match, InputData, StringMap, getChainByName, cborDecode } from '../../../services/core/build/index';
import { FileService } from '../../../src/server/services/FileService';

const multihashes: any = require('multihashes');

import { NotFoundError } from '../../common/errors';

export interface InjectorConfig {
    infuraPID?: string,
    localChainUrl?: string,
    silent?: boolean,
    log?: bunyan,
    offline?: boolean
}

export default class Injector {
    private log: bunyan;
    private chains: any;
    private infuraPID: string;
    private localChainUrl: string | undefined;
    private offline: boolean;
    public fileService: FileService;

    /**
     * Constructor
     * @param {InjectorConfig = {}} config
     */
    public constructor(config: InjectorConfig = {}) {
        this.chains = {};
        this.infuraPID = config.infuraPID || "changeinfuraid";
        this.localChainUrl = config.localChainUrl;
        this.offline = config.offline || false;

        this.log = config.log || Logger("Injector");

        this.fileService = new FileService(this.log);

        if (!this.offline) {
            this.initChains();
        }
    }

    /**
     * Instantiates a web3 provider for all public ethereum networks via Infura.
     * If environment variable TESTING is set to true, localhost:8545 is also available.
     */
    private initChains() {
        for (const chain of ['mainnet', 'ropsten', 'rinkeby', 'kovan', 'goerli']) {
            const chainOption = getChainByName(chain);
            this.chains[chainOption.chainId] = {};
            if (this.infuraPID === "changeinfuraid") {
                const web3 = chainOption.fullnode.dappnode;
                this.chains[chainOption.chainId].web3 = new Web3(web3);
            } else {
                const web3 = chainOption.web3[0].replace('${INFURA_ID}', this.infuraPID);
                this.chains[chainOption.chainId].web3 = new Web3(web3);
            }
        }

        // For unit testing with testrpc...
        if (this.localChainUrl) {
            const chainOption = getChainByName('localhost');
            this.chains[chainOption.chainId] = {
                web3: new Web3(chainOption.web3[0])
            };
        }
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
        compiledBytecode: string
    ): Promise<Match> {
        let match: Match = { address: null, status: null };

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
                deployedBytecode = await getBytecode(this.chains[chain].web3, address)
            } catch (e) { /* ignore */ }

            const status = this.compareBytecodes(deployedBytecode, compiledBytecode);

            if (status) {
                match = { address: address, status: status };
                break;
            }
        }
        return match;
    }

    /**
     * Returns a string description of how closely two bytecodes match. Bytecodes
     * that match in all respects apart from their metadata hashes are 'partial'.
     * Bytecodes that don't match are `null`.
     * @param  {string} deployedBytecode
     * @param  {string} compiledBytecode
     * @return {string | null}  match description ('perfect'|'partial'|null)
     */
    private compareBytecodes(
        deployedBytecode: string | null,
        compiledBytecode: string
    ): 'perfect' | 'partial' | null {

        if (deployedBytecode && deployedBytecode.length > 2) {
            if (deployedBytecode === compiledBytecode) {
                return 'perfect';
            }

            if (trimMetadata(deployedBytecode) === trimMetadata(compiledBytecode)) {
                return 'partial';
            }
        }
        return null;
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
            throw new Error("Missing chain name for submitted sources/metadata");;
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
    public async inject(
        inputData: InputData
    ): Promise<Match> {
        const { repository, chain, addresses, files } = inputData;
        this.validateAddresses(addresses);
        this.validateChain(chain);

        let match: Match = {
            address: null,
            status: null
        };

        for (const source of files) {

            // Starting from here, we cannot trust the metadata object anymore,
            // because it is modified inside recompile.
            const target = Object.assign({}, source.metadata.settings.compilationTarget);

            let compilationResult: RecompilationResult;
            try {
                compilationResult = await recompile(source.metadata, source.solidity, this.log)
            } catch (err) {
                this.log.info({ loc: `[RECOMPILE]`, err: err });
                throw err;
            }

            // When injector is called by monitor, the bytecode has already been
            // obtained for address and we only need to compare w/ compilation result.
            if (inputData.bytecode) {

                const status = this.compareBytecodes(
                    inputData.bytecode,
                    compilationResult.deployedBytecode
                )

                match = {
                    address: Web3.utils.toChecksumAddress(addresses[0]),
                    status: status
                }

                // For other cases, we need to retrieve the code for specified address
                // from the chain.
            } else {
                match = await this.matchBytecodeToAddress(
                    chain,
                    addresses,
                    compilationResult.deployedBytecode
                )
            }

            // Since the bytecode matches, we can be sure that we got the right
            // metadata file (up to json formatting) and exactly the right sources.
            // Now we can store the re-compiled and correctly formatted metadata file
            // and the sources.
            if (match.address && match.status === 'perfect') {

                this.storePerfectMatchData(repository, chain, match.address, compilationResult, source.solidity)

            } else if (match.address && match.status === 'partial') {

                this.storePartialMatchData(repository, chain, match.address, compilationResult, source.solidity)

            } else {
                const err = new Error(
                    `Could not match on-chain deployed bytecode to recompiled bytecode for:\n` +
                    `${JSON.stringify(target, null, ' ')}\n` +
                    `Addresses checked:\n` +
                    `${JSON.stringify(addresses, null, ' ')}`
                );

                this.log.info({
                    loc: '[INJECT]',
                    chain: chain,
                    addresses: addresses,
                    err: err
                })

                throw new NotFoundError(err.message);
            }
        }
        return match;
    }
}


/**
 * Compiles sources using version and settings specified in metadata
 * @param  {any}                          metadata
 * @param  {string[]}                     sources  solidity files
 * @return {Promise<RecompilationResult>}
 */
export async function recompile(
    metadata: any,
    sources: StringMap,
    log: Logger
): Promise<RecompilationResult> {

    const {
        input,
        fileName,
        contractName
    } = reformatMetadata(metadata, sources, log);

    const version = metadata.compiler.version;

    log.info(
        {
            loc: '[RECOMPILE]',
            fileName: fileName,
            contractName: contractName,
            version: version
        },
        'Recompiling'
    );

    const solcjs: any = await new Promise((resolve, reject) => {
        solc.loadRemoteVersion(`v${version}`, (error: Error, soljson: any) => {
            (error) ? reject(error) : resolve(soljson);
        });
    });

    const compiled: any = solcjs.compile(JSON.stringify(input));
    const output = JSON.parse(compiled);
    const contract: any = output.contracts[fileName][contractName];

    return {
        bytecode: contract.evm.bytecode.object,
        deployedBytecode: `0x${contract.evm.deployedBytecode.object}`,
        metadata: contract.metadata.trim()
    }
}

/**
 * Formats metadata into an object which can be passed to solc for recompilation
 * @param  {any}                 metadata solc metadata object
 * @param  {string[]}            sources  solidity sources
 * @return {ReformattedMetadata}
 */
function reformatMetadata(
    metadata: any,
    sources: StringMap,
    log: Logger
): ReformattedMetadata {

    const input: any = {};
    let fileName: string = '';
    let contractName: string = '';

    input.settings = metadata.settings;

    for (fileName in metadata.settings.compilationTarget) {
        contractName = metadata.settings.compilationTarget[fileName];
    }

    delete input['settings']['compilationTarget']

    if (contractName == '') {
        const err = new Error("Could not determine compilation target from metadata.");
        log.info({ loc: '[REFORMAT]', err: err });
        throw err;
    }

    input['sources'] = {}
    for (const source in sources) {
        input.sources[source] = { 'content': sources[source] }
    }

    input.language = metadata.language
    input.settings.metadata = input.settings.metadata || {}
    input.settings.outputSelection = input.settings.outputSelection || {}
    input.settings.outputSelection[fileName] = input.settings.outputSelection[fileName] || {}

    input.settings.outputSelection[fileName][contractName] = [
        'evm.bytecode',
        'evm.deployedBytecode',
        'metadata'
    ];

    return {
        input: input,
        fileName: fileName,
        contractName: contractName
    }
}

export interface RecompilationResult {
    bytecode: string,
    deployedBytecode: string,
    metadata: string
}

declare interface ReformattedMetadata {
    input: any,
    fileName: string,
    contractName: string
}

/**
 * Wraps eth_getCode
 * @param {Web3}   web3    connected web3 instance
 * @param {string} address contract
 */
export async function getBytecode(web3: Web3, address: string) {
    address = web3.utils.toChecksumAddress(address);
    return await web3.eth.getCode(address);
};


/**
 * Removes post-fixed metadata from a bytecode string
 * (for partial bytecode match comparisons )
 * @param  {string} bytecode
 * @return {string}          bytecode minus metadata
 */
export function getBytecodeWithoutMetadata(bytecode: string): string {
    // Last 4 chars of bytecode specify byte size of metadata component,
    const metadataSize = parseInt(bytecode.slice(-4), 16) * 2 + 4;
    return bytecode.slice(0, bytecode.length - metadataSize);
}
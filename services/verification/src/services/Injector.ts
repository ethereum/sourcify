import Web3 from 'web3';
import * as bunyan from 'bunyan';
import { IVerificationService, VerificationService } from '../services/VerificationService';
import { IFileService, FileService, } from 'sourcify-core/build';
import { Logger, Match, InputData,  getChainByName, RecompilationResult, NotFoundError, InjectorConfig} from 'sourcify-core/build/index'
import { IValidationService, ValidationService } from 'sourcify-validation/src/services/ValidationService';


export default class Injector {
  private logger: bunyan;
  private chains: any;
  private infuraPID: string;
  private localChainUrl: string | undefined;
  private offline: boolean;
  public fileService: IFileService;
  public validationService: IValidationService;
  public verificationService: IVerificationService;

  /**
   * Constructor
   * @param {InjectorConfig = {}} config
   */
  public constructor(config: InjectorConfig = {}) {
    this.chains = {};
    this.infuraPID = config.infuraPID || "changeinfuraid";
    this.localChainUrl = config.localChainUrl;
    this.offline = config.offline || false;

    this.logger = config.log || Logger("Injector");

    this.fileService = new FileService(this.logger);
    this.validationService = new ValidationService(this.fileService);
    this.verificationService = new VerificationService(this.fileService);

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
    this.validationService.validateAddresses(addresses);
    this.validationService.validateChain(chain);

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
        compilationResult = await this.verificationService.recompile(source.metadata, source.solidity, this.logger)
      } catch (err) {
        this.logger.info({ loc: `[RECOMPILE]`, err: err });
        throw err;
      }

      // When injector is called by monitor, the bytecode has already been
      // obtained for address and we only need to compare w/ compilation result.
      if (inputData.bytecode) {

        const status = this.verificationService.compareBytecodes(
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
        match = await this.verificationService.matchBytecodeToAddress(
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

        this.fileService.storePerfectMatchData(repository, chain, match.address, compilationResult, source.solidity)

      } else if (match.address && match.status === 'partial') {

        this.fileService.storePartialMatchData(repository, chain, match.address, compilationResult, source.solidity)

      } else {
        const err = new Error(
          `Could not match on-chain deployed bytecode to recompiled bytecode for:\n` +
          `${JSON.stringify(target, null, ' ')}\n` +
          `Addresses checked:\n` +
          `${JSON.stringify(addresses, null, ' ')}`
        );

        this.logger.info({
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

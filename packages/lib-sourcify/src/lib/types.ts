import { Abi } from 'abitype';
import SourcifyChain from './SourcifyChain';
import { FetchRequest } from 'ethers';
export interface PathBuffer {
  path: string;
  buffer: Buffer;
}

export interface PathContent {
  path: string;
  content: string;
}

export interface StringMap {
  [key: string]: string;
}

export interface InvalidSources {
  [key: string]: {
    expectedHash: string;
    calculatedHash: string;
    msg?: string; // Keep msg for compatibilty with legacy UI
  };
}

export interface MissingSources {
  [key: string]: {
    keccak256: string;
    urls: string[];
  };
}

export interface MetadataSource {
  keccak256: string;
  content?: string;
  urls?: string[];
  license?: string;
}

export interface MetadataSourceMap {
  [index: string]: MetadataSource;
}

export interface Devdoc {
  author?: string;
  details?: string;
  errors?: {
    [index: string]: {
      details?: string;
    };
  };
  events?: {
    [index: string]: {
      details?: string;
      params?: any;
    };
  };
  kind: 'dev';
  methods: {
    [index: string]: {
      details?: string;
      params?: any;
      returns?: any;
    };
  };
  stateVariables?: any;
  title?: string;
  version?: number;
}

export interface Userdoc {
  errors?: {
    [index: string]: {
      notice?: string;
    }[];
  };
  events?: {
    [index: string]: {
      notice?: string;
    };
  };
  kind: 'user';
  methods: {
    [index: string]: {
      notice: string;
    };
  };
  version?: number;
}

export interface MetadataOutput {
  abi: Abi;
  devdoc: Devdoc;
  userdoc: Userdoc;
}

// Metadata type that reflects the metadata object from
// https://docs.soliditylang.org/en/latest/metadata.html
export interface Metadata {
  compiler: {
    keccak256?: string;
    version: string;
  };
  language: string;
  output: MetadataOutput;
  settings: {
    compilationTarget: {
      [sourceName: string]: string;
    };
    evmVersion: string;
    libraries?: {
      [index: string]: string;
    };
    metadata?: {
      appendCBOR?: boolean;
      bytecodeHash?: 'none' | 'ipfs' | 'bzzr0' | 'bzzr1';
      useLiteralContent?: boolean;
    };
    optimizer?: {
      details?: {
        constantOptimizer?: boolean;
        cse?: boolean;
        deduplicate?: boolean;
        inliner?: boolean;
        jumpdestRemover?: boolean;
        orderLiterals?: boolean;
        peephole?: boolean;
        yul?: boolean;
        yulDetails?: {
          optimizerSteps?: string;
          stackAllocation?: boolean;
        };
      };
      enabled: boolean;
      runs: number;
    };
    viaIR?: boolean;
    outputSelection?: any;
  };
  sources: MetadataSourceMap;
  version: number;
}

// TODO: Fully define solcJsonInput
export declare interface CompilableMetadata {
  solcJsonInput: JsonInput;
  contractPath: string;
  contractName: string;
}

export interface ImmutableReferences {
  [key: string]: Array<{
    length: number;
    start: number;
  }>;
}

export interface LinkReferences {
  [filePath: string]: {
    [libraryName: string]: [
      {
        length: number;
        start: number;
      },
    ];
  };
}

export interface RecompilationResult {
  creationBytecode: string;
  runtimeBytecode: string;
  metadata: string;
  immutableReferences: ImmutableReferences;
  creationLinkReferences: LinkReferences;
  runtimeLinkReferences: LinkReferences;
}

export type Transformation = {
  type: 'insert' | 'replace';
  reason:
    | 'constructorArguments'
    | 'library'
    | 'immutable'
    | 'cborAuxdata'
    | 'callProtection';
  offset: number;
  id?: string;
};

// Call protection is always at the start of the runtime bytecode
export const CallProtectionTransformation = (): Transformation => ({
  type: 'replace',
  reason: 'callProtection',
  offset: 1, // 1 byte is always the PUSH20 opcode 0x73
});

// TransformationValues only has one ConstructorTransformatino so no id field is needed
export const ConstructorTransformation = (offset: number): Transformation => ({
  type: 'insert',
  reason: 'constructorArguments',
  offset,
});

export const AuxdataTransformation = (
  offset: number,
  id: string,
): Transformation => ({
  type: 'replace',
  reason: 'cborAuxdata',
  offset,
  id,
});

export const LibraryTransformation = (
  offset: number,
  id: string,
): Transformation => ({
  type: 'replace',
  reason: 'library',
  offset,
  id,
});

export const ImmutablesTransformation = (
  offset: number,
  id: string,
): Transformation => ({
  type: 'replace',
  reason: 'immutable',
  offset,
  id,
});

export interface TransformationValues {
  constructorArguments?: string;
  callProtection?: string;
  libraries?: {
    [id: string]: string;
  };
  immutables?: {
    [id: string]: string;
  };
  cborAuxdata?: {
    [id: string]: string;
  };
}

export interface Match {
  address: string;
  chainId: string;
  runtimeMatch: Status;
  creationMatch: Status;
  storageTimestamp?: Date;
  message?: string;
  abiEncodedConstructorArguments?: string;
  create2Args?: Create2Args;
  libraryMap?: StringMap;
  creatorTxHash?: string;
  immutableReferences?: ImmutableReferences;
  runtimeTransformations?: Transformation[];
  creationTransformations?: Transformation[];
  runtimeTransformationValues?: TransformationValues;
  creationTransformationValues?: TransformationValues;
  onchainRuntimeBytecode?: string;
  onchainCreationBytecode?: string;
  blockNumber?: number;
  txIndex?: number;
  deployer?: string;
}

export type Status =
  | 'perfect'
  | 'partial'
  | 'extra-file-input-bug'
  | 'error'
  | null;

export interface Create2Args {
  deployerAddress: string;
  salt: string;
  constructorArgs?: any[];
}

export interface ContractCreationFetcher {
  type: 'scrape' | 'api';
  url: string;
  responseParser?: Function;
  scrapeRegex?: string[];
}

export interface FetchContractCreationTxMethods {
  blockscoutApi?: {
    url: string;
  };
  blockscoutScrape?: {
    url: string;
    blockscoutPrefix?: string;
  };
  routescanApi?: {
    type: 'mainnet' | 'testnet';
  };
  etherscanApi?: boolean;
  etherscanScrape?: {
    url: string;
  };
  blocksScanApi?: {
    url: string;
  };
  meterApi?: {
    url: string;
  };
  telosApi?: {
    url: string;
  };
  avalancheApi?: boolean;
  nexusApi?: {
    url: string;
    runtime: string;
  };
}

// types of the keys of FetchContractCreationTxMethods
export type FetchContractCreationTxMethod =
  keyof FetchContractCreationTxMethods;

export type TraceSupport = 'trace_transaction' | 'debug_traceTransaction';

export type BaseRPC = {
  url: string;
  type: 'BaseRPC';
  traceSupport?: TraceSupport;
};

// override the type of BaseRPC to add the type field
export type APIKeyRPC = Omit<BaseRPC, 'type'> & {
  type: 'APIKeyRPC';
  apiKeyEnvName: string;
};

// override the type of BaseRPC to add the type field
export type FetchRequestRPC = Omit<BaseRPC, 'type'> & {
  type: 'FetchRequest';
  headers?: Array<{
    headerName: string;
    headerEnvName: string;
  }>;
};

export type TraceSupportedRPC = {
  type: TraceSupport;
  index: number;
};

export type SourcifyChainExtension = {
  sourcifyName: string; // Keep it required to not forget name in sourcify-chains.json
  supported: boolean;
  etherscanApi?: {
    apiURL: string;
    apiKeyEnvName?: string;
  };
  fetchContractCreationTxUsing?: FetchContractCreationTxMethods;
  rpc?: Array<string | BaseRPC | APIKeyRPC | FetchRequestRPC>;
};

export type RPCObjectWithTraceSupport = {
  rpc: string | FetchRequest;
  traceSupport?: TraceSupport;
};

export interface SourcifyChainsExtensionsObject {
  [chainId: string]: SourcifyChainExtension;
}

// TODO: Double check against ethereum-lists/chains type
export type Chain = {
  name: string;
  title?: string;
  chainId: number;
  shortName?: string;
  network?: string;
  networkId?: number;
  nativeCurrency?: Currency;
  rpc: Array<string>;
  faucets?: string[];
  infoURL?: string;
};

export type SourcifyChainMap = {
  [chainId: string]: SourcifyChain;
};

type Currency = {
  name: string;
  symbol: string;
  decimals: number;
};

interface File {
  keccak256?: string;
  urls?: string[];
  content?: string;
}

interface Sources {
  [key: string]: File;
}

interface YulDetails {
  stackAllocation: boolean;
  optimizerSteps?: string;
}

interface Details {
  peephole?: boolean;
  inliner?: boolean;
  jumpdestRemover?: boolean;
  orderLiterals?: boolean;
  deduplicate?: boolean;
  cse?: boolean;
  constantOptimizer?: boolean;
  yul?: boolean;
  yulDetails?: YulDetails;
}

interface Optimizer {
  enabled?: boolean;
  runs?: number;
  details?: Details;
}

enum DebugInfo {
  default = 'default',
  strip = 'strip',
  debug = 'debug',
  verboseDebug = 'verboseDebug',
}

interface Debug {
  revertStrings: DebugInfo;
  debugInfo?: string[];
}

interface SettingsMetadata {
  useLiteralContent?: boolean;
  bytecodeHash?: string;
}

interface MapContractAddress {
  [key: string]: string;
}

export interface Libraries {
  [key: string]: MapContractAddress;
}

interface OutputSelection {
  [key: string]: any;
}

interface Contracts {
  [key: string]: string[];
}

interface ModelChecker {
  contracts?: Contracts;
  divModNoSlacks?: boolean;
  engine?: string;
  invariants?: string[];
  showUnproved?: boolean;
  solvers?: string[];
  targets?: string[];
  timeout?: number;
}

interface Settings {
  stopAfter?: string;
  remappings?: string[];
  optimizer?: Optimizer;
  evmVersion?: string;
  viaIR?: boolean;
  debug?: Debug;
  metadata?: SettingsMetadata;
  libraries?: Libraries;
  outputSelection: OutputSelection;
  modelChecker?: ModelChecker;
  compilationTarget?: string;
}

export interface JsonInput {
  language: string;
  sources: Sources;
  settings?: Settings;
}
interface CompilerOutputError {
  sourceLocation?: {
    file: string;
    start: number;
    end: number;
  };
  type: 'TypeError' | 'InternalCompilerError' | 'Exception';
  component: 'general' | 'ewasm';
  severity: 'error' | 'warning';
  message: string;
  formattedMessage?: string;
}
interface CompilerOutputEvmBytecode {
  object: string;
  opcodes?: string;
  sourceMap?: string;
  linkReferences?:
    | {}
    | {
        [globalName: string]: {
          [name: string]: { start: number; length: number }[];
        };
      };
}

interface CompilerOutputEvmDeployedBytecode extends CompilerOutputEvmBytecode {
  immutableReferences?: ImmutableReferences;
}
export interface CompilerOutputSources {
  [globalName: string]: {
    id: number;
    ast: any;
    legacyAST: any;
  };
}

export interface StorageLayout {
  storage: {
    astId: number;
    contract: string;
    label: string;
    offset: number;
    slot: string;
    type: string;
  };
  types: {
    [index: string]: {
      encoding: string;
      label: string;
      numberOfBytes: string;
    };
  };
}
interface CompilerOutputContracts {
  [globalName: string]: {
    [contractName: string]: {
      abi: Abi;
      metadata: string;
      userdoc?: any;
      devdoc?: any;
      ir?: string;
      irAst?: any;
      irOptimized?: string;
      irOptimizedAst?: any;
      storageLayout?: StorageLayout;
      evm: {
        assembly?: string;
        legacyAssembly?: any;
        bytecode: CompilerOutputEvmBytecode;
        deployedBytecode?: CompilerOutputEvmDeployedBytecode;
        methodIdentifiers?: {
          [methodName: string]: string;
        };
        gasEstimates?: {
          creation: {
            codeDepositCost: string;
            executionCost: string;
            totalCost: string;
          };
          external: {
            [functionSignature: string]: string;
          };
          internal: {
            [functionSignature: string]: string;
          };
        };
      };
      ewasm?: {
        wast: string;
        wasm: string;
      };
    };
  };
}
export interface CompilerOutput {
  errors?: CompilerOutputError[];
  sources?: CompilerOutputSources;
  contracts: CompilerOutputContracts;
}

export interface CompiledContractCborAuxdata {
  [index: string]: {
    offset: number;
    value: string;
  };
}

export interface AuxdataDiff {
  real: string;
  diffStart: number;
  diff: string;
}

export interface IpfsGateway {
  url: string;
  headers?: HeadersInit;
}

// https://geth.ethereum.org/docs/developers/evm-tracing/built-in-tracers#call-tracer
export interface CallFrame {
  type: string;
  from: string;
  to: string;
  value: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  error: string;
  revertReason: string;
  calls: CallFrame[];
}

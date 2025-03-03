import { setLogger, setLevel, ILogger } from './logger';

// export * from './lib/validation';
// export * from './lib/verification';
// export * from './lib/SolidityCheckedContract';

// export * from './lib/AbstractCheckedContract';
export { default as SourcifyChain } from './SourcifyChain';
export const setLibSourcifyLogger = setLogger;
export const setLibSourcifyLoggerLevel = setLevel;
export type ILibSourcifyLogger = ILogger;
export * from './Compilation/AbstractCompilation';
export * from './Compilation/SolidityCompilation';
export * from './Compilation/VyperCompilation';
export * from './Compilation/VyperTypes';
export * from './Compilation/SolidityTypes';
export * from './Compilation/CompilationTypes';
export * from './Verification/Verification';
export * from './Verification/VerificationTypes';
export * from './Validation/SolidityMetadataContract';
export * from './Validation/ValidationTypes';
export * from './Validation/processFiles';
export { Match, Language, Status } from './lib/types';
export { SolidityCheckedContract } from './lib/SolidityCheckedContract';
export { checkFilesWithMetadata, useAllSources } from './lib/validation';
export { matchWithRuntimeBytecode } from './lib/verification';
export {
  isEmpty,
  AbstractCheckedContract,
} from './lib/AbstractCheckedContract';
export { VyperCheckedContract } from './lib/VyperCheckedContract';
export { verifyDeployed } from './lib/verification';
export {
  SourcifyChainMap,
  SourcifyChainsExtensionsObject,
  Chain,
  APIKeyRPC,
  FetchRequestRPC,
  BaseRPC,
  TraceSupportedRPC,
  ContractCreationFetcher,
  FetchContractCreationTxMethod,
} from './lib/types';
export * from './Verification/Transformations';
export { findContractPathFromContractName } from './lib/SolidityCheckedContract';
export * from './Validation/fetchUtils';
export { unzipFiles } from './Validation/zipUtils';
export { rearrangeSources, storeByHash } from './lib/validation';

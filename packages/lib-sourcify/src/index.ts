import { setLogger, setLevel, ILogger } from './lib/logger';

export * from './lib/validation';
export * from './lib/verification';
export * from './lib/CheckedContract';
export * from './lib/types';
export * from './lib/solidityCompiler';
export const setLibSourcifyLogger = setLogger;
export const setLibSourcifyLoggerLevel = setLevel;
export type ILibSourcifyLogger = ILogger;

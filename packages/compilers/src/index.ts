import { setLogger, setLevel, ILogger } from './logger';
export const setCompilersLogger = setLogger;
export const setCompilersLoggerLevel = setLevel;
export type ICompilersLogger = ILogger;

export * from './lib/solidityCompiler';
export * from './lib/vyperCompiler';

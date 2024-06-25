import { logWarn } from './logger';

interface RequestInitTimeout extends RequestInit {
  timeout?: number;
}

export async function fetchWithTimeout(
  resource: string,
  options: RequestInitTimeout = {},
) {
  const { timeout = 10000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => {
    logWarn('Aborting request', { resource, timeout });
    controller.abort();
  }, timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

export const replaceBytecodeAuxdatasWithZeros = (
  bytecode: string,
  offsetStart: number,
  offsetEnd: number,
) =>
  bytecode.slice(0, offsetStart) +
  '0'.repeat(offsetEnd - offsetStart) +
  bytecode.slice(offsetEnd);

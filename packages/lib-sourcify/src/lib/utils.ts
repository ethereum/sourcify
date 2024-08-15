import { logDebug, logError } from './logger';

/**
 * Fetches a resource with an exponential timeout.
 * 1) Send req, wait backoff * 2^0 ms, abort if doesn't resolve
 * 2) Send req, wait backoff * 2^1 ms, abort if doesn't resolve
 * 3) Send req, wait backoff * 2^2 ms, abort if doesn't resolve...
 * ...
 * ...
 */
export async function fetchWithBackoff(
  resource: string,
  headers: HeadersInit = {},
  backoff: number = 10000,
  retries: number = 4,
) {
  let timeout = backoff;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      logDebug('Start fetchWithBackoff', {
        resource,
        headers,
        timeout,
        attempt,
      });
      const controller = new AbortController();
      const id = setTimeout(() => {
        logDebug('Aborting request', { resource, headers, timeout, attempt });
        controller.abort();
      }, timeout);
      const response = await fetch(resource, {
        signal: controller.signal,
        headers,
      });
      logDebug('Success fetchWithBackoff', { resource, timeout, attempt });
      clearTimeout(id);
      return response;
    } catch (error) {
      if (attempt === retries) {
        logError('Failed fetchWithBackoff', {
          resource,
          headers,
          attempt,
          retries,
          timeout,
          error,
        });
        throw new Error(`Failed fetching ${resource}: ${error}`);
      } else {
        timeout *= 2; // exponential backoff
        logDebug('Retrying fetchWithBackoff', {
          resource,
          headers,
          attempt,
          timeout,
          error,
        });
        continue;
      }
    }
  }
  throw new Error(`Failed fetching ${resource}`);
}

export const replaceBytecodeAuxdatasWithZeros = (
  bytecode: string,
  offsetStart: number,
  offsetEnd: number,
) =>
  bytecode.slice(0, offsetStart) +
  '0'.repeat(offsetEnd - offsetStart) +
  bytecode.slice(offsetEnd);

declare const process: {
  env: { [key: string]: string | undefined };
};

// Check if we are running in a Node.js environment
export const isNode =
  typeof process !== 'undefined' &&
  // eslint-disable-next-line no-prototype-builtins
  process.hasOwnProperty('env') &&
  // eslint-disable-next-line no-prototype-builtins
  process.env.hasOwnProperty('NODE_ENV');

export const fs = isNode ? require('fs') : undefined;
export const spawnSync = isNode
  ? // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('child_process').spawnSync
  : undefined;
export const Path = isNode ? require('path') : undefined;
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const solc = isNode ? require('solc') : undefined;

require('isomorphic-fetch');

interface RequestInitTimeout extends RequestInit {
  timeout?: number;
}

export async function fetchWithTimeout(
  resource: string,
  options: RequestInitTimeout = {}
) {
  const { timeout = 8000 } = options;

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  clearTimeout(id);
  return response;
}

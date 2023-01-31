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

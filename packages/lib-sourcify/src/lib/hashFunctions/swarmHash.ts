import { makeChunkedFile } from '@fairdatasociety/bmt-js';

export function swarmHash(file: string) {
  // convert file to Uint8Array
  const encoder = new TextEncoder();
  const fileBytes = encoder.encode(file);

  // Binary Merkle Tree on the file
  const chunkedFile = makeChunkedFile(fileBytes);

  // get the address from the chunked file
  const bytes = chunkedFile.address();

  // convert the address to hex string
  const hexByte = (n: number) => n.toString(16).padStart(2, '0');
  return Array.from(bytes, hexByte).join('');
}

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import {
  performFetch,
  fetchWithBackoff,
  getIpfsGateway,
} from '../../src/Validation/fetchUtils';
import { id as keccak256str } from 'ethers';

describe('fetchUtils', () => {
  let originalFetch: typeof fetch;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalFetch = global.fetch;
    originalEnv = process.env;
    process.env = { ...process.env };
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = originalEnv;
  });

  describe('performFetch', () => {
    it('should successfully fetch content', async () => {
      const content = 'test content';
      const hash = keccak256str(content);
      global.fetch = async () => new Response(content, { status: 200 });

      const result = await performFetch('https://test.com', hash, 'test.txt');
      expect(result).to.equal(content);
    });

    it('should return null if hash does not match', async () => {
      const content = 'test content';
      const wrongHash = keccak256str('wrong content');
      global.fetch = async () => new Response(content, { status: 200 });

      const result = await performFetch(
        'https://test.com',
        wrongHash,
        'test.txt',
      );
      expect(result).to.be.null;
    });

    it('should return null on failed fetch', async () => {
      global.fetch = async () => new Response('Not Found', { status: 404 });

      const result = await performFetch('https://test.com');
      expect(result).to.be.null;
    });
  });

  describe('fetchWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      global.fetch = async () => new Response('success', { status: 200 });

      const response = await fetchWithBackoff('https://test.com');
      expect(response.status).to.equal(200);
      const text = await response.text();
      expect(text).to.equal('success');
    });

    it('should retry on failure and succeed eventually', async () => {
      let attempts = 0;
      global.fetch = async () => {
        attempts++;
        if (attempts < 2) throw new Error('Temporary failure');
        return new Response('success', { status: 200 });
      };

      const response = await fetchWithBackoff('https://test.com', {}, 100, 2);
      expect(response.status).to.equal(200);
      expect(attempts).to.equal(2);
    });

    it('should throw after max retries', async () => {
      global.fetch = async () => {
        throw new Error('Persistent failure');
      };

      try {
        await fetchWithBackoff('https://test.com', {}, 100, 2);
        expect.fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).to.include('Failed fetching');
      }
    });
  });

  describe('getIpfsGateway', () => {
    it('should return default gateway when no env variables set', () => {
      delete process.env.IPFS_GATEWAY;
      delete process.env.IPFS_GATEWAY_HEADERS;

      const gateway = getIpfsGateway();
      expect(gateway.url).to.equal('https://ipfs.io/ipfs/');
      expect(gateway.headers).to.be.undefined;
    });

    it('should use custom gateway from env', () => {
      process.env.IPFS_GATEWAY = 'https://custom.gateway/ipfs';

      const gateway = getIpfsGateway();
      expect(gateway.url).to.equal('https://custom.gateway/ipfs/');
    });

    it('should parse headers from env', () => {
      const headers = { Authorization: 'Bearer token' };
      process.env.IPFS_GATEWAY_HEADERS = JSON.stringify(headers);

      const gateway = getIpfsGateway();
      expect(gateway.headers).to.deep.equal(headers);
    });

    it('should throw on invalid headers JSON', () => {
      process.env.IPFS_GATEWAY_HEADERS = 'invalid json';

      expect(() => getIpfsGateway()).to.throw(
        'Error while parsing IPFS_GATEWAY_HEADERS option',
      );
    });
  });
});

import { whatsabi, AutoloadResult } from "@shazow/whatsabi";
import logger from "../../../common/logger";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import type { ProxyResolver } from "@shazow/whatsabi/lib.types/proxies";

export type ProxyType =
  | "EIP1967Proxy"
  | "GnosisSafeProxy"
  | "DiamondProxy"
  | "PROXIABLEProxy"
  | "ZeppelinOSProxy"
  | "FixedProxy"
  | "SequenceWalletProxy";

export class ProxyContractResolver {
  proxyType: ProxyType | null = null;
  private detectionResult?: AutoloadResult;

  constructor(
    public bytecode: string,
    public address: string,
  ) {}

  async detectProxy(): Promise<ProxyType | null> {
    if (this.detectionResult) {
      return this.proxyType;
    }

    const codeCache = {
      [this.address]: this.bytecode,
    };
    const cachedCodeProvider = whatsabi.providers.WithCachedCode(
      {}, // Provider not needed for detection only
      codeCache,
    );

    const result = await whatsabi.autoload(this.address, {
      provider: cachedCodeProvider,
      abiLoader: false,
      signatureLookup: false,
      followProxies: false,
    });
    this.detectionResult = result;

    this.proxyType = getProxyType(result.proxies);

    logger.info("Ran proxy detection", {
      address: this.address,
      bytecode: this.bytecode,
      proxyType: this.proxyType,
    });

    return this.proxyType;
  }

  async resolve(sourcifyChain: SourcifyChain): Promise<string[]> {
    if (!this.detectionResult) {
      throw new Error("Proxy detection not run yet");
    }
    if (
      !this.detectionResult.proxies ||
      this.detectionResult.proxies.length === 0 ||
      this.proxyType === null
    ) {
      throw new Error("No proxy detected");
    }

    try {
      const implementations: string[] = [];

      if (this.proxyType === "FixedProxy") {
        // In this case we should resolve all fixed proxies
        // and ignore other types of proxies (see getProxyType function)
        const fixedProxies = this.detectionResult.proxies.filter(
          (proxy) => proxy.name === "FixedProxy",
        );
        for (const proxy of fixedProxies) {
          implementations.push(
            await proxy.resolve(sourcifyChain, this.address),
          );
        }
      } else if (this.proxyType === "DiamondProxy") {
        // TODO: Implement diamond proxy resolution. The issue at the moment is that getting facets via whatsabi is not working
      } else {
        const firstMatching = this.detectionResult.proxies.find(
          (proxy) => proxy.name === this.proxyType,
        );
        if (!firstMatching) {
          throw new Error("Detection result mismatching proxy type");
        }
        implementations.push(
          await firstMatching.resolve(sourcifyChain, this.address),
        );
      }

      return implementations;
    } catch (error) {
      const errorMessage = "Failed to resolve implementation addresses";
      logger.error(errorMessage, {
        address: this.address,
        bytecode: this.bytecode,
        proxyType: this.proxyType,
        error: (error as Error)?.message,
      });

      throw new Error(errorMessage);
    }
  }
}

function getProxyType(proxies: ProxyResolver[]): ProxyType | null {
  if (
    proxies.length === 1 ||
    // If there are multiple and all are the same type
    // we can safely resolve them
    (proxies.length > 1 &&
      proxies.every((proxy) => proxy.name === proxies[0].name))
  ) {
    return proxies[0].name as ProxyType;
  }

  if (proxies.length > 1) {
    // We have multiple different types of proxies
    if (proxies.some((proxy) => proxy.name === "FixedProxy")) {
      // See https://github.com/sourcifyeth/data-analysis-scripts/blob/main/multi-proxy-analysis-results/multi-implementation-addresses.json
      // I found a lot of mixtures between FixedProxy and EIP1967Proxy.
      // In these cases all EIP1967Proxies would resolve to 0x0000000000000000000000000000000000000000,
      // while the FixedProxies would resolve to real addresses.
      return "FixedProxy";
    } else {
      // Rare edge case. My investigations show that this only
      // applies to a handfull of contracts
      return proxies[0].name as ProxyType;
    }
  }

  return null;
}

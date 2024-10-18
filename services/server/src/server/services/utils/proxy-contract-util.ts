import { whatsabi } from "@shazow/whatsabi";
import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import {
  DiamondProxyResolver,
  FixedProxyResolver,
} from "@shazow/whatsabi/lib.types/proxies";

export type ProxyType =
  | "EIP1167Proxy"
  | "FixedProxy"
  | "EIP1967Proxy"
  | "GnosisSafeProxy"
  | "DiamondProxy"
  | "PROXIABLEProxy"
  | "ZeppelinOSProxy"
  | "SequenceWalletProxy";

export interface ProxyDetectionResult {
  isProxy: boolean;
  proxyType: ProxyType | null;
  implementations: string[];
}

export async function detectAndResolveProxy(
  bytecode: string,
  address: string,
  sourcifyChain: SourcifyChain,
): Promise<ProxyDetectionResult> {
  // Detection
  const codeCache = {
    [address]: bytecode,
  };
  const cachedCodeProvider = whatsabi.providers.WithCachedCode(
    {}, // Provider not needed for detection only
    codeCache,
  );

  const detectionResult = await whatsabi.autoload(address, {
    provider: cachedCodeProvider,
    abiLoader: false,
    signatureLookup: false,
    followProxies: false,
  });
  const proxies = detectionResult.proxies;

  // Resolution
  const fixedProxy = proxies.find(
    (proxy) => proxy instanceof FixedProxyResolver,
  );
  if (fixedProxy && isEIP1167Proxy(bytecode, fixedProxy.resolvedAddress)) {
    return {
      isProxy: true,
      proxyType: "EIP1167Proxy",
      implementations: [fixedProxy.resolvedAddress],
    };
  } // Ignore FixedProxy otherwise because it could be a false-positive

  const diamondProxy = proxies.find(
    (proxy) => proxy instanceof DiamondProxyResolver,
  );
  if (diamondProxy) {
    // TODO
    return { isProxy: true, proxyType: "DiamondProxy", implementations: [] };
  }

  const checkedProxyTypes: Set<ProxyType> = new Set([
    "FixedProxy",
    "DiamondProxy",
  ]); // Needed because of potential duplicates
  for (const proxy of proxies) {
    if (checkedProxyTypes.has(proxy.name as ProxyType)) {
      continue;
    }

    const resolvedAddress = await proxy.resolve(sourcifyChain, address);
    if (resolvedAddress !== "0x0000000000000000000000000000000000000000") {
      return {
        isProxy: true,
        proxyType: proxy.name as ProxyType,
        implementations: [resolvedAddress],
      };
    }

    checkedProxyTypes.add(proxy.name as ProxyType);
  }

  return { isProxy: false, proxyType: null, implementations: [] };
}

function isEIP1167Proxy(bytecode: string, resolvedAddress: string): boolean {
  return bytecode
    .toLowerCase()
    .endsWith(
      `363d3d373d3d3d363d73${resolvedAddress.slice(2)}5af43d82803e903d91602b57fd5bf3`,
    );
}
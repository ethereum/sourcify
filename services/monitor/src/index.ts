import { SourcifyChain } from "@ethereum-sourcify/lib-sourcify";
import Monitor from "./Monitor";

if (require.main === module) {
  const monitor = new Monitor(
    [
      new SourcifyChain({
        chainId: 11155111,
        rpc: ["https://rpc2.sepolia.org/"],
        name: "Ethereum Sepolia",
        shortName: "sepolia",
        networkId: 11155111,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        supported: true,
        // monitored: false,
        monitored: true,
      }),
      new SourcifyChain({
        chainId: 5,
        rpc: [
          "https://eth-goerli.g.alchemy.com/v2/HYwo9i9e5mlOs0d5VEKUdnP-t0Y2n_F2",
        ],
        name: "Ethereum Goerli",
        shortName: "goerli",
        networkId: 5,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        supported: true,
        monitored: false,
        // monitored: true,
      }),
      new SourcifyChain({
        chainId: 1337,
        rpc: ["http://localhost:8545/"],
        name: "Localhost",
        shortName: "Localhost",
        networkId: 1337,
        nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
        supported: true,
        monitored: false,
      }),
    ],
    {
      ipfs: {
        enabled: true,
        gateways: ["https://ipfs.io/ipfs/"],
      },
    },
    ["http://localhost:5555/verify/"]
  );
  monitor
    .start()
    .then(() => {
      console.log("Monitor started successfully");
    })
    .catch((error) => {
      console.error("Failed to start monitor", error);
    });
}

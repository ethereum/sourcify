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
        monitored: true,
      }),
    ],
    {
      ipfs: {
        enabled: true,
        gateways: ["https://ipfs.io/ipfs/"],
      },
    }
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

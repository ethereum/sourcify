import ganache from "ganache";
import path from "path";
import fs from "fs";
import {
  deployFromAbiAndBytecodeForCreatorTxHash,
  readFilesFromDirectory,
} from "./helpers";
import { deployFromAbiAndBytecode } from "../helpers/helpers";
import { JsonRpcProvider, JsonRpcSigner, Network } from "ethers";
import { LOCAL_CHAINS } from "../../src/sourcify-chains";
import nock from "nock";
import storageContractArtifact from "../testcontracts/Storage/Storage.json";
import storageContractMetadata from "../testcontracts/Storage/metadata.json";

const storageContractSourcePath = path.join(
  __dirname,
  "..",
  "testcontracts",
  "Storage",
  "Storage.sol"
);
const storageContractSource = fs.readFileSync(storageContractSourcePath);

const GANACHE_PORT = 8545;
const DEFAULT_CHAIN_ID = "1337";

export type LocalChainFixtureOptions = {
  chainId?: string;
};

export class LocalChainFixture {
  defaultContractSource = storageContractSource;
  defaultContractMetadata = Buffer.from(
    JSON.stringify(storageContractMetadata)
  );
  defaultContractModifiedIpfsMetadata = getModifiedIpfsMetadata();
  defaultContractArtifact = storageContractArtifact;

  private _chainId?: string;
  private _localSigner?: JsonRpcSigner;
  private _defaultContractAddress?: string;
  private _defaultContractCreatorTx?: string;

  // Getters for type safety
  // Can be safely accessed in "it" blocks
  get chainId(): string {
    if (!this._chainId) throw new Error("chainId not initialized!");
    return this._chainId;
  }
  get localSigner(): JsonRpcSigner {
    if (!this._localSigner) throw new Error("localSigner not initialized!");
    return this._localSigner;
  }
  get defaultContractAddress(): string {
    if (!this._defaultContractAddress)
      throw new Error("defaultContractAddress not initialized!");
    return this._defaultContractAddress;
  }
  get defaultContractCreatorTx(): string {
    if (!this._defaultContractCreatorTx)
      throw new Error("defaultContractCreatorTx not initialized!");
    return this._defaultContractCreatorTx;
  }

  /**
   * Creates a local test chain and deploys the test contract.
   * Expected to be called in a "describe" block.
   */
  constructor(options: LocalChainFixtureOptions = {}) {
    this._chainId = options.chainId ?? DEFAULT_CHAIN_ID;
    const ganacheServer = ganache.server({
      wallet: { totalAccounts: 1 },
      chain: {
        chainId: parseInt(this._chainId),
        networkId: parseInt(this._chainId),
      },
    });

    before(async () => {
      await ganacheServer.listen(GANACHE_PORT);

      // Init IPFS mock with all the necessary pinned files
      const mockContent = await readFilesFromDirectory(
        path.join(__dirname, "..", "mocks", "ipfs")
      );
      for (const ipfsKey of Object.keys(mockContent)) {
        nock(process.env.IPFS_GATEWAY || "")
          .persist()
          .get("/" + ipfsKey)
          .reply(function () {
            return [200, mockContent[ipfsKey]];
          });
      }

      const sourcifyChainGanache = LOCAL_CHAINS[0];
      console.log("Started ganache local server on port " + GANACHE_PORT);
      const ethersNetwork = new Network(
        sourcifyChainGanache.rpc[0] as string,
        sourcifyChainGanache.chainId
      );
      this._localSigner = await new JsonRpcProvider(
        `http://localhost:${GANACHE_PORT}`,
        ethersNetwork,
        { staticNetwork: ethersNetwork }
      ).getSigner();
      console.log("Initialized Provider");

      // Deploy the test contract
      const { contractAddress, txHash } =
        await deployFromAbiAndBytecodeForCreatorTxHash(
          this._localSigner,
          storageContractArtifact.abi,
          storageContractArtifact.bytecode
        );

      this._defaultContractAddress = contractAddress;
      this._defaultContractCreatorTx = txHash;
    });

    after(async () => {
      await ganacheServer.close();
      nock.cleanAll();
    });
  }
}

function getModifiedIpfsMetadata(): Buffer {
  const ipfsAddress =
    storageContractMetadata.sources["project:/contracts/Storage.sol"].urls[1];
  // change the last char in ipfs hash of the source file
  const lastChar = ipfsAddress.charAt(ipfsAddress.length - 1);
  const modifiedLastChar = lastChar === "a" ? "b" : "a";
  const modifiedIpfsAddress =
    ipfsAddress.slice(0, ipfsAddress.length - 1) + modifiedLastChar;
  // the metadata needs to be deeply cloned here
  // unfortunately `structuredClone` is not available in Node 16
  const modifiedIpfsMetadata = JSON.parse(
    JSON.stringify(storageContractMetadata)
  );
  modifiedIpfsMetadata.sources["project:/contracts/Storage.sol"].urls[1] =
    modifiedIpfsAddress;
  return Buffer.from(JSON.stringify(modifiedIpfsMetadata));
}

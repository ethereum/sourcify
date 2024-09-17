import chai from "chai";
import { getCreatorTx } from "../../../src/server/services/utils/contract-creation-util";
import { sourcifyChainsMap } from "../../../src/sourcify-chains";
import { ChainRepository } from "../../../src/sourcify-chain-repository";

describe("contract creation util", function () {
  it("should run getCreatorTx with chainId 40", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 40,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 40 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x4c09368a4bccD1675F276D640A0405Efa9CD4944",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0xb7efb33c736b1e8ea97e356467f99d99221343f077ce31a3e3ac1d2e0636df1d",
      );
  });

  // Commenting out as fails way too often
  // it("should run getCreatorTx with chainId 51", async function () {
  //   const sourcifyChain = sourcifyChainsArray.find(
  //     (sourcifyChain) => sourcifyChain.chainId === 51
  //   );
  //   if (!sourcifyChain) {
  //     chai.assert.fail("No chain for chainId 51 configured");
  //   }
  //   const creatorTx = await getCreatorTx(
  //     sourcifyChain,
  //     "0x8C3FA94eb5b07c9AF7dBFcC53ea3D2BF7FdF3617"
  //   );
  //   chai
  //     .expect(creatorTx)
  //     .equals(
  //       "0xb1af0ec1283551480ae6e6ce374eb4fa7d1803109b06657302623fc65c987420"
  //     );
  // });

  it("should run getCreatorTx with chainId 83", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 83,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 83 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x89e772941d94Ef4BDA1e4f68E79B4bc5F6096389",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0x8cc7b0fb66eaf7b32bac7b7938aedfcec6d49f9fe607b8008a5541e72d264069",
      );
  });

  it("should run getCreatorTx with chainId 335", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 335,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 335 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x40D843D06dAC98b2586fD1DFC5532145208C909F",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0xd125cc92f61d0898d55a918283f8b855bde15bc5f391b621e0c4eee25c9997ee",
      );
  });

  it("should run getCreatorTx with regex for new Blockscout", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 100,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 100 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x3CE1a25376223695284edc4C2b323C3007010C94",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0x11da550e6716be8b4bd9203cb384e89b8f8941dc460bd99a4928ce2825e05456",
      );
  });

  it("should run getCreatorTx with regex for old Blockscout", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 57,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 57 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x43e9f7ca4AEAcd67A7AC4a275cee7BC8AF601bE4",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0x89a8c2ac5f93b91a8a551bf4c676755e1ad5272e0a7193b894aa8ba14c43c5ea",
      );
  });

  it("should run getCreatorTx with etherscanApi for Etherscan", async function () {
    // Don't run if it's an external PR. Etherscan tests need API keys that can't be exposed to external PRs.
    if (process.env.CIRCLE_PR_REPONAME !== undefined) {
      return;
    }

    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 1,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 1 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x00000000219ab540356cBB839Cbe05303d7705Fa",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0xe75fb554e433e03763a1560646ee22dcb74e5274b34c5ad644e7c0f619a7e1d0",
      );
  });

  it("should run getCreatorTx with nexusApi for Nexus", async function () {
    const sourcifyChainsArray = new ChainRepository(sourcifyChainsMap).sourcifyChainsArray;
    const sourcifyChain = sourcifyChainsArray.find(
      (sourcifyChain) => sourcifyChain.chainId === 23294,
    );
    if (!sourcifyChain) {
      chai.assert.fail("No chain for chainId 23294 configured");
    }
    const creatorTx = await getCreatorTx(
      sourcifyChain,
      "0x8Bc2B030b299964eEfb5e1e0b36991352E56D2D3",
    );
    chai
      .expect(creatorTx)
      .equals(
        "0xce775b521cc6e1341020560441d77cd634b0972fc34bf96f79e9fab81caa8ab7",
      );
  });
});

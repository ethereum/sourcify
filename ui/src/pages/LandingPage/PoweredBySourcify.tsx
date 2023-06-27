import blockscout from "../../assets/integrations/blockscout.png";
import ethSdk from "../../assets/integrations/eth-sdk.png";
import keystone from "../../assets/integrations/keystone.png";
import otter from "../../assets/integrations/otter.jpg";
import walleth from "../../assets/integrations/walleth.png";
import dexGuru from "../../assets/integrations/dexGuru.svg";
import AppIconName from "../../components/AppIconName";

export default function PoweredBySourcify() {
  return (
    <div className="w-full">
      <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
        Powered by Sourcify
      </h2>
      <div
        className="flex justify-center md:justify-start flex-row mt-8 flex-wrap logos-container"
        id="networks-container"
      >
        <AppIconName img={walleth} name="Walleth" href="https://walleth.org/" />
        <AppIconName
          img={otter}
          name="Otterscan"
          href="https://twitter.com/wmitsuda/status/1444789707540414466"
          rounded
        />
        <AppIconName
          img={blockscout}
          name="Blockscout"
          href="https://docs.blockscout.com/for-users/smart-contract-interaction/verifying-a-smart-contract/contracts-verification-via-sourcify"
        />
        <AppIconName
          img={keystone}
          name="Keystone"
          href="https://twitter.com/SourcifyEth/status/1415319812801183753"
        />
        <AppIconName
          img={ethSdk}
          name="eth-sdk"
          href="https://github.com/dethcrypto/eth-sdk/pull/42"
        />
        <AppIconName
          img={dexGuru}
          name="DexGuru Block Explorer"
          href="https://b2b.dex.guru/explorer"
        />
      </div>
    </div>
  );
}

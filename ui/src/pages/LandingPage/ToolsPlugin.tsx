import HardhatDeploy from "../../assets/integrations/hardhat-deploy";
import remix from "../../assets/integrations/remix.png";
import foundry from "../../assets/integrations/foundry.png";
import truffle from "../../assets/integrations/truffle.png";
import wagmi from "../../assets/integrations/wagmi.png";
import AppIconName from "../../components/AppIconName";

export default function ToolsPlugin() {
  return (
    <div className="w-full mt-16">
      {/* Right col: Tools */}
      <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
        Frameworks & Plugins
      </h2>
      <div className="flex justify-center md:justify-start flex-row mt-8 flex-wrap logos-container">
        <AppIconName
          img={foundry}
          name="Foundry"
          href="https://twitter.com/r_krasiuk/status/1559225185563205636/photo/1"
        />
        <AppIconName
          Svg={HardhatDeploy}
          name="hardhat-deploy"
          href="https://github.com/wighawag/hardhat-deploy#5-hardhat-sourcify"
        />
        <AppIconName
          img={remix}
          name="Remix IDE"
          href="https://medium.com/remix-ide/verify-contracts-on-remix-with-sourcify-2912004d9c84"
        />
        <AppIconName
          img={truffle}
          name="truflle-plugin-verify"
          href="https://github.com/rkalis/truffle-plugin-verify"
        />
        <AppIconName
          img={wagmi}
          name='Wagmi'
          href="https://wagmi.sh/cli/plugins/sourcify"
        />
      </div>
    </div>
  );
}

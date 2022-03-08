import HardhatDeploy from "../../assets/integrations/hardhat-deploy";
import remix from "../../assets/integrations/remix.png";
import AppIconName from "../../components/AppIconName";

export default function ToolsPlugin() {
  return (
    <div className="w-full mt-16">
      {/* Right col: Tools */}
      <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
        Verification Plugins
      </h2>
      <div className="flex justify-center md:justify-start flex-row mt-8 logos-container">
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
      </div>
    </div>
  );
}

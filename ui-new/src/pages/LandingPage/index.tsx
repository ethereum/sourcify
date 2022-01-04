import { HiArrowDown } from "react-icons/hi";
import ReactTooltip from "react-tooltip";
import arbitrum from "../../assets/chains/arbitrum.svg";
import avalanche from "../../assets/chains/avalanche.png";
import boba from "../../assets/chains/boba.png";
import bsc from "../../assets/chains/bsc.png";
import celo from "../../assets/chains/celo.png";
import ethereum from "../../assets/chains/ethereum.png";
import optimism from "../../assets/chains/optimism.svg";
import polygon from "../../assets/chains/polygon.webp";
import xdai from "../../assets/chains/xdai.png";
import code from "../../assets/contract-code.png";
import bytecode from "../../assets/contract-info.png";
import blockscoutSS from "../../assets/integrations/blockscout-screenshot.png";
import blockscout from "../../assets/integrations/blockscout.png";
import hardhatDeploy from "../../assets/integrations/hardhat-deploy.jpeg";
import keystone from "../../assets/integrations/keystone.png";
import otter from "../../assets/integrations/otter.jpg";
import remix from "../../assets/integrations/remix.png";
import walleth from "../../assets/integrations/walleth.png";
import Header from "../../components/Header";
import Chart from "./Chart";

type AppIconNameProps = {
  img: string;
  name: string;
};
const AppIconName = ({ img, name }: AppIconNameProps) => (
  <div className="flex flex-col ">
    <img src={img} className="w-32 transition-opacity ease-in-out" />
    <div className="text-center mt-1">{name}</div>
  </div>
);

const LandingPage = () => {
  return (
    <div>
      <div className="h-screen flex flex-col px-8 md:px-12 lg:px-24 bg-gray-100">
        <Header />
        <section className="grid grid-cols-2 gap-8 flex-1">
          {/* Hero left */}
          <div className="flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4">
              For informed decisions and a more transparent UX in web3
            </h1>
            <h2 className="text-xl ">
              Sourcify is a decentralized metadata and source code repository*
              and automatic verification service*.{" "}
            </h2>
            <div className="flex justify-evenly">
              <a href="/verifier" target="_blank">
                <button className="mt-4 py-2 px-4 bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default">
                  Verify Contract
                </button>
              </a>
              <button className="mt-4 py-2 px-4 bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default">
                Check Contract
              </button>
            </div>
          </div>

          {/* Hero right */}
          <div
            className="flex items-center justify-center relative"
            id="hero-image"
          >
            {/* <div className="relative min-h-[450px]"> */}
            <div
              className="absolute mt-32 mr-32 z-10 transition-all duration-300 ease-in-out hover:mb-32 hover:ml-32"
              id="hero-source-code"
            >
              <img src={code} className="w-96" />
            </div>
            <div
              className="absolute mb-32 ml-32 z-0 transition-all duration-300 ease-in-out  hover:mt-32 hover:mr-32"
              id="hero-bytecode"
            >
              <img src={bytecode} className="w-96" />
            </div>
            {/* </div> */}
          </div>
        </section>
        <button className="my-4">
          <HiArrowDown className="inline" /> Learn more
        </button>
      </div>

      {/* About section */}
      <section className="px-8 md:px-12 lg:px-24 bg-white py-16">
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          Sourcify enables simple, next-level source verification.
        </h1>
        <div className="mt-12">
          <p className="font-mono text-lg">
            Sourcify helps to make interacting with smart contracts on the
            blockchain safer and more transparent for users. To achieve this
            goal, we support several efforts to foster adoption of open-source
            source verification, metadata files and NatSpec comments.
          </p>
          <p className="mt-6">
            At its core, Sourcify currently maintains an interface that helps
            developers to verify metadata and contract source code and users to
            check whether contracts have been verified:
            <ul>
              <li>- a contract repository of all verified contracts.</li>
              <li>
                - a monitoring & verifier service that checks for new contracts
                on several blockchains (see supported networks) and tries to
                verify them automatically.
              </li>
              <li>- an API</li>
              <li>- ??? a NPM package ???</li>
            </ul>
          </p>
          <div className="mt-6 pt-12">
            <h3>Why do all this?</h3>
            <p className="mt-4">
              Sourcify aims to enable trust-minimized, well-informed web3
              interactions by helping the ecosystem to turn transaction
              hex-strings displayed in wallets into human readable information.
              On a technical level, that means keeping metadata and source files
              available via IPFS and creating a decentralized infrastructure
              base layer, which allows other tools to be built on top of it.
            </p>
          </div>
        </div>
      </section>

      {/* Supported Networks */}
      <section className="px-8 md:px-12 lg:px-24 bg-gray-100 py-16">
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          Supported Networks
        </h1>
        <div className="mt-8">
          <p>
            For a full overview of all supported networks, see the Supported
            Networks Grid in the documentation.
          </p>
          <p>
            Getting Sourcify support for your network is easy. Please follow the
            instructions in the docs to get started.{" "}
          </p>
        </div>
        <ReactTooltip effect="solid" />
        <div className="flex flex-row mt-8 w-full justify-evenly py-16 logos-container flex-wrap">
          <img
            src={ethereum}
            data-tip="Ethereum"
            className="w-24 transition-opacity mx-4 my-4 "
          />
          <img
            src={arbitrum}
            data-tip="Arbitrum"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={avalanche}
            data-tip="Avalanche"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={bsc}
            data-tip="Binance Smart Chain"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={boba}
            data-tip="Boba Network"
            className="rounded-full w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={celo}
            data-tip="Celo"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={polygon}
            data-tip="Polygon"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={optimism}
            data-tip="Optimism"
            className="w-24 transition-opacity mx-4 my-4"
          />
          <img
            src={xdai}
            data-tip="Gnosis Chain"
            className="w-24 transition-opacity mx-4 my-4"
          />
        </div>
        <button className="mx-auto">and many more</button>
      </section>

      {/* Integrations & Tools */}
      <section className="px-8 md:px-12 lg:px-24 bg-white py-16">
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          Integrations
        </h1>
        <div className="grid grid-cols-2 gap-12 mt-12">
          {/* Left col: Apps & Tools */}
          <div className="w-full">
            {/* Apps */}
            <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
              Who is building with Sourcify?
            </h2>
            <div
              className="flex flex-row justify-evenly mt-8 flex-wrap logos-container"
              id="networks-container"
            >
              <AppIconName img={walleth} name="Walleth" />
              <AppIconName img={otter} name="Otterscan" />
              <AppIconName img={blockscout} name="Blockscout" />
              <AppIconName img={keystone} name="Keystone" />
            </div>
            {/* Tools */}
            <div className="mt-8">
              <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
                Tools & Plugins
              </h2>
              <div className="flex flex-row justify-evenly mt-4 logos-container">
                <AppIconName img={hardhatDeploy} name="hardhat-deploy" />
                <AppIconName img={remix} name="Remix IDE" />
              </div>
            </div>
          </div>

          {/* Right col: examples */}
          <div className="px-12">
            <img src={blockscoutSS} className="px-12" />
          </div>
        </div>
        <div className="mt-12">
          <h3 className="text-center text-xl font-semibold text-ceruleanBlue-800">
            Do you want to integrate Sourcify into your project?
          </h3>
          <div className="flex justify-center">
            <button className="mt-4 py-2 px-4 bg-ceruleanBlue-500 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-white transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default">
              Check Docs
            </button>
            <button className="ml-4 mt-4 py-2 px-4 bg-ceruleanBlue-100 hover:bg-ceruleanBlue-130 disabled:hover:bg-ceruleanBlue-500 focus:ring-ceruleanBlue-300 focus:ring-offset-ceruleanBlue-100 text-ceruleanBlue-500 transition ease-in duration-200 text-center text-base font-semibold shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 rounded-lg disabled:opacity-50 disabled:cursor-default">
              Get in touch
            </button>
          </div>
        </div>
      </section>

      {/* Verified contract stats */}
      <section className="flex flex-col items-center px-8 md:px-12 lg:px-24 bg-white py-16">
        <Chart />
      </section>
    </div>
  );
};

export default LandingPage;

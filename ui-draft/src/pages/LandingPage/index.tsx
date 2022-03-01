// AnimateOnScroll
import AOS from "aos";
import "aos/dist/aos.css";
import { useRef } from "react";
import { BsChevronCompactDown } from "react-icons/bs";
import { HiCheckCircle } from "react-icons/hi";
import { Link } from "react-router-dom";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import jsonLang from "react-syntax-highlighter/dist/esm/languages/prism/json";
import solidityLang from "react-syntax-highlighter/dist/esm/languages/prism/solidity";
import lightStyle from "react-syntax-highlighter/dist/esm/styles/prism/ghcolors";
import codeStyle from "react-syntax-highlighter/dist/esm/styles/prism/vsc-dark-plus";
import ReactTooltip from "react-tooltip";
import arbitrum from "../../assets/chains/arbitrum.svg";
import avalanche from "../../assets/chains/avalanche.png";
import bsc from "../../assets/chains/binance.png";
import boba from "../../assets/chains/boba.png";
import celo from "../../assets/chains/celo.png";
import ethereum from "../../assets/chains/ethereum.png";
import optimism from "../../assets/chains/optimism.svg";
import polygon from "../../assets/chains/polygon.webp";
import xdai from "../../assets/chains/xdai.png";
import decode from "../../assets/decode.gif";
import blockscout from "../../assets/integrations/blockscout.png";
import ethSdk from "../../assets/integrations/eth-sdk.png";
import HardhatDeploy from "../../assets/integrations/hardhat-deploy";
import keystone from "../../assets/integrations/keystone.png";
import otter from "../../assets/integrations/otter.jpg";
import remix from "../../assets/integrations/remix.png";
import walleth from "../../assets/integrations/walleth.png";
import openSourceDecentralized from "../../assets/openSourceDecentralized.svg";
import verification from "../../assets/verification.svg";
import AppIconName from "../../components/AppIconName";
import Button from "../../components/Button";
import Header from "../../components/Header";
import {
  DOCS_URL,
  IPFS_IPNS_GATEWAY_URL,
  REPOSITORY_URL_FULL_MATCH,
} from "../../constants";
import ChartSection from "./ChartSection";
import sourceCode from "./Contract.sol";
import CustomCarousel from "./CustomCarousel";
import metadata from "./metadata.json";
AOS.init({
  duration: 800,
  once: true,
});

SyntaxHighlighter.registerLanguage("solidity", solidityLang);
SyntaxHighlighter.registerLanguage("json", jsonLang);

// Helper components

type ResourceListItemProps = {
  children: string;
  href: string;
  date?: string;
};
const ResourceListItem = ({ children, href, date }: ResourceListItemProps) => (
  <li>
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="colored-bullet text-gray-600 hover:text-ceruleanBlue-500"
    >
      <span className="link-underline">{children}</span>{" "}
      {date && <span className="text-gray-400 text-sm">{"- " + date}</span>}
    </a>
  </li>
);
type FooterItemProps = {
  href?: string;
  children: string;
};
const FooterItem = ({ href, children }: FooterItemProps) => (
  <a href={href} target="_blank" rel="noreferrer">
    <li className="text-ceruleanBlue-300 hover:text-ceruleanBlue-100">
      {children}
    </li>
  </a>
);

const A = ({ href, children }: FooterItemProps) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="text-ceruleanBlue-500 link-underline"
  >
    {children}
  </a>
);
//////////////////////////////////
///////// MAIN COMPONENT /////////
//////////////////////////////////

const LandingPage = () => {
  const aboutRef = useRef<HTMLElement>(null);
  return (
    <div>
      <div className="h-screen flex flex-col px-8 md:px-12 lg:px-24 bg-gray-100">
        <Header />
        <section className="grid grid-cols-2 gap-8 flex-1">
          {/* Hero left */}
          <div className="flex flex-col justify-center">
            <h1 className="text-5xl font-bold mb-4 leading-tight">
              Source-verified smart contracts for transparency and better UX in
              web3
            </h1>
            <h2 className="text-xl ">
              Sourcify enables transparent and human-readable smart contract
              interactions through automated Solidity contract verification,
              contract metadata, and NatSpec comments.
            </h2>
            <div className="flex justify-evenly mt-4">
              <Link to="/verifier">
                <Button>Verify Contract</Button>
              </Link>
              <Link to="/lookup">
                <Button type="secondary">Lookup Contract</Button>
              </Link>
            </div>
          </div>

          {/* Hero right */}
          <div className="flex items-center justify-center" id="">
            <div
              className="flex items-center justify-center relative"
              id="hero-image"
            >
              {/* Front visual */}
              <div
                className="absolute mt-32 mr-32 z-10 transition-all duration-300 ease-in-out hover:mb-32 hover:ml-32"
                id="hero-source-code"
              >
                <SyntaxHighlighter
                  language="solidity"
                  style={codeStyle}
                  className="rounded-md"
                  customStyle={{
                    fontSize: "0.7rem",
                    lineHeight: "1.2",
                    padding: "1rem",
                  }}
                  codeTagProps={{
                    style: { fontSize: "inherit", lineHeight: "inherit" },
                  }}
                >
                  {sourceCode}
                </SyntaxHighlighter>
                {/* <img src={code} className="w-96" alt="source code visual" /> */}
              </div>
              {/* Back visual */}
              <div
                className="absolute mb-32 ml-32 z-0 transition-all duration-300 ease-in-out  hover:mt-32 hover:mr-32"
                id="hero-bytecode"
              >
                <div className="bg-ceruleanBlue-100 px-4 py-2 rounded-md outline-2 outline-ceruleanBlue-400 outline w-96">
                  <div className="py-4">
                    {/* <div className="text-green-700 bg-green-100 rounded-md outline-2 outline-green-400 outline inline py-1 px-1"> */}
                    <div className=" text-green-600 flex items-center">
                      <HiCheckCircle className="text-green-600 inline mr-1 align-middle text-xl" />
                      Contract fully verified
                    </div>
                  </div>
                  <div className="whitespace-nowrap overflow-hidden overflow-ellipsis ">
                    <img
                      src={ethereum}
                      className="h-6 inline mb-1"
                      alt="eth icon"
                    />
                    <a
                      href={`${REPOSITORY_URL_FULL_MATCH}/5/0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4`}
                      className="link-underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <b>Ethereum Görli</b>{" "}
                      0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4
                    </a>
                  </div>
                  <div className="mt-4">
                    <p>metadata.json</p>
                    <SyntaxHighlighter
                      language="json"
                      style={lightStyle}
                      className="rounded-md overflow-y-scroll h-64 p-3 m-3"
                      customStyle={{
                        fontSize: "0.7rem",
                        lineHeight: "1.2",
                      }}
                      codeTagProps={{
                        style: { fontSize: "inherit", lineHeight: "inherit" },
                      }}
                    >
                      {metadata}
                    </SyntaxHighlighter>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <a className="my-4 flex justify-center" href="/#about">
          <BsChevronCompactDown className="inline text-4xl animate-bounce text-gray-500" />
        </a>
      </div>

      {/* About section */}
      <section
        className="px-8 md:px-12 lg:px-48 bg-white py-16"
        ref={aboutRef}
        id="about"
      >
        <div className="mt-12">
          <div className="flex items-center">
            <div className="flex-1" data-aos="fade-right">
              <img
                src={openSourceDecentralized}
                alt="Illustration depicting open source and decentralized development"
                className="pr-48 pl-8 -scale-x-100"
              />
            </div>
            <div className="flex-1" data-aos="fade-left">
              <h1 className="text-2xl text-ceruleanBlue-500 font-bold">
                🦄 Fully open-source and decentralized
              </h1>{" "}
              <p className="text-lg mt-4">
                Sourcify's code is fully open-sourced. The repository of
                verified contracts is completely public and decentralized by
                being served over <A href={IPFS_IPNS_GATEWAY_URL}>IPFS</A>.
              </p>
            </div>
          </div>
        </div>
        <div className="my-24 text-right">
          <div className="flex items-center">
            <div className="flex-1" data-aos="fade-right">
              <h1 className="text-2xl text-ceruleanBlue-500 font-bold">
                ✅ Next-level smart contract verification
              </h1>{" "}
              <p className="text-lg mt-4">
                <A href="https://docs.sourcify.dev/docs/full-vs-partial-match/">
                  Full matches
                </A>{" "}
                on Sourcify cryptographically guarantee the verified source code
                is identical to the original deployed contract. 🕵️Our monitoring
                service observes contract creations and verifies the source
                codes automatically if published to IPFS.
              </p>
            </div>
            <div className="flex-1" data-aos="fade-left">
              <img
                src={verification}
                alt="Illustration of contract verification"
                className="pr-48 pl-8 max-h-80"
              />
            </div>
          </div>
        </div>
        <div className="mb-12" data-aos="fade-left">
          <div className="flex items-center">
            <div className="flex-1 flex justify-end" data-aos="fade-right">
              <img
                src={decode}
                alt="Decoding contract interaction with Sourcify"
                className="pl-48 pr-8"
              />
            </div>
            <div className="flex-1" data-aos="fade-left">
              <h1 className="text-2xl text-ceruleanBlue-500 font-bold">
                👶 Human-readable contract intractions
              </h1>
              <p className="text-lg">
                Goodbye YOLO signing 👋. Decode contract interactions with the
                verified contract's ABI and{" "}
                <A href="https://docs.soliditylang.org/en/develop/natspec-format.html">
                  NatSpec comments
                </A>{" "}
                . Show wallet users meaningful information instead of hex
                strings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Supported Networks */}
      <section
        className="px-8 md:px-12 lg:px-24 bg-gray-100 py-16"
        data-aos="fade"
      >
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          ⛓ Supported Chains
        </h1>
        <div className="mt-8 text-lg">
          <p>Sourcify is multi-chain and works on all EVM based networks.</p>
        </div>
        <ReactTooltip effect="solid" />
        <div className="flex flex-row w-full justify-center py-16 logos-container flex-wrap">
          <img
            src={ethereum}
            data-tip="Ethereum"
            className="h-12 md:h-24 transition-opacity mx-4 my-4 "
            alt="Ethereum logo"
          />
          <img
            src={arbitrum}
            data-tip="Arbitrum"
            className="h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Arbitrum logo"
          />
          <img
            src={avalanche}
            data-tip="Avalanche"
            className="h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Avalanche logo"
          />
          <img
            src={bsc}
            data-tip="Binance Smart Chain"
            className="h-12 md:h-24 transition-opacity mx-4 my-4 rounded-full"
            alt="Binance Smart Chain logo"
          />
          <img
            src={boba}
            data-tip="Boba Network"
            className="rounded-full h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Boba network logo"
          />
          <img
            src={celo}
            data-tip="Celo"
            className="h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Celo logo"
          />
          <img
            src={xdai}
            data-tip="Gnosis Chain (xDai)"
            className="h-12 md:h-24 transition-opacity mx-4 my-4 rounded-full"
            alt="Gnosis chain (xDai) logo"
          />
          <img
            src={polygon}
            data-tip="Polygon"
            className="h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Polygon logo"
          />
          <img
            src={optimism}
            data-tip="Optimism"
            className="h-12 md:h-24 transition-opacity mx-4 my-4"
            alt="Optimism logo"
          />
          <div className="p-1 h-14 w-14 text-xs md:text-base md:h-24 md:w-24 transition-opacity rounded-full mx-4 my-4 text-ceruleanBlue-400 flex justify-center items-center text-center">
            <a
              href={`${DOCS_URL}/docs/networks`}
              target="_blank"
              rel="noreferrer"
            >
              And many more!
            </a>
          </div>
        </div>
        <div className="flex justify-center">
          <a
            href={`${DOCS_URL}/docs/networks`}
            target="_blank"
            rel="noreferrer"
            // className="underline decoration-lightCoral-500 decoration-2 font-semibold text-ceruleanBlue-500"
            className="link-underline font-semibold text-ceruleanBlue-500"
          >
            See all networks
          </a>
        </div>
      </section>

      {/* Integrations & Tools */}
      <section
        className="px-8 md:px-12 lg:px-24 bg-white py-16"
        data-aos="fade"
      >
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          🛠️ Integrations
        </h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 mt-12">
          {/* Left col: Apps */}
          <div className="w-full">
            <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
              Who is building with Sourcify?
            </h2>
            <div
              className="flex flex-row mt-8 flex-wrap logos-container"
              id="networks-container"
            >
              <AppIconName
                img={walleth}
                name="Walleth"
                href="https://walleth.org/"
              />
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
            </div>
          </div>
          <div>
            {/* Right col: Tools */}
            <h2 className="text-2xl text-ceruleanBlue-500 font-semibold">
              Tools & Plugins
            </h2>
            <div className="flex flex-row mt-8 logos-container">
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
        </div>
        {/* Examples carousel */}
        <div className="flex justify-center mt-12">
          <CustomCarousel />
        </div>
        <div className="mt-12">
          <h3 className="text-center text-xl font-semibold text-ceruleanBlue-800">
            Want to integrate Sourcify into your project?
          </h3>
          <div className="flex justify-center">
            <a href={DOCS_URL} target="_blank" rel="noreferrer">
              <Button>Check Docs</Button>
            </a>
            <a
              href="https://gitter.im/ethereum/source-verify"
              target="_blank"
              rel="noreferrer"
            >
              <Button type="secondary" className="ml-4">
                Get in touch
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Verified contract stats */}
      <section
        className="flex flex-col items-center px-8 md:px-12 lg:px-24 bg-gray-100 py-16"
        data-aos="fade"
      >
        <ChartSection />
      </section>

      {/* Talks & Articles */}
      <section
        className="px-8 md:px-12 lg:px-24 bg-white py-16"
        data-aos="fade"
      >
        <h1 className="text-3xl text-ceruleanBlue-500 font-bold">
          👀 Resources
        </h1>
        <div className="flex flex-col items-center mt-8">
          <iframe
            className="w-[24rem] h-[14rem] sm:w-[32rem] sm:h-[18rem] md:w-[48rem] md:h-[27rem]"
            src="https://www.youtube.com/embed/z5D613Qt7Kc"
            title="Next Level Source Code Verification w: Sourcify"
            frameBorder="0"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-8">
            <ul>
              <h3 className="text-ceruleanBlue-500 uppercase text-lg font-semibold">
                📖 Read
              </h3>
              <ResourceListItem
                href="https://blog.soliditylang.org/2020/06/25/sourcify-faq/"
                date="25 Jun 2020"
              >
                All you need to know about Sourcify
              </ResourceListItem>
              <ResourceListItem
                href="https://blog.soliditylang.org/2020/06/02/sourcify-towards-safer-contract-interaction-for-humans/"
                date="02 June 2020"
              >
                Sourcify: Towards Safer Contract Interactions for Humans
              </ResourceListItem>
              <ResourceListItem
                href="https://news.shardlabs.io/how-smart-contracts-can-be-automatically-verified-28ee1c5cf941"
                date="29 Jan 2021"
              >
                How Smart Contracts Can Be Automatically Verified
              </ResourceListItem>
              <ResourceListItem
                href="https://medium.com/remix-ide/verify-contracts-on-remix-with-sourcify-2912004d9c84"
                date="26 Jun 2020"
              >
                Verify Contracts on Remix with Sourcify
              </ResourceListItem>
              <ResourceListItem
                href="https://soliditydeveloper.com/decentralized-etherscan/"
                date="21 Nov 2020"
              >
                The future of a Decentralized Etherscan
              </ResourceListItem>
            </ul>
            <ul>
              <h3 className="text-ceruleanBlue-500 uppercase text-lg font-semibold">
                📽 Watch
              </h3>
              <ResourceListItem
                href="https://vimeo.com/639594632"
                date="21 Oct 2021"
              >
                Goodbye YOLO-Signing
              </ResourceListItem>
              <ResourceListItem
                href="https://www.youtube.com/watch?v=Zc_fJElIooQ"
                date="22 Jul 2021"
              >
                Franziska Heintel : Sourcify: Towards Safer Contract
                Interactions for Humans
              </ResourceListItem>
              <ResourceListItem
                href="https://www.youtube.com/watch?v=uYvbBP3GEFk&list=PLaM7G4Llrb7xlGxwlYGTy1T-GHpytE3RC&index=23"
                date="13 May 2020"
              >
                Verify all the sources by Ligi
              </ResourceListItem>
              <ResourceListItem
                href="https://www.youtube.com/watch?v=_73OrDbpxoY&list=PLrtFm7U0BIfUH7g1-blb-eYFgzOYWhvqm&index=13"
                date="04 Mar 2020"
              >
                Christian Reitwiessner: Improving Wallet UX and Security through
                a Decentralized Metadata and Source Code Repository
              </ResourceListItem>
            </ul>
          </div>
        </div>
      </section>

      <footer className="px-48 py-16 bg-ceruleanBlue-500 text-white text-xl">
        <nav className="font-vt323 grid grid-cols-3 gap-8">
          <div>
            <h3 className="uppercase font-bold text-ceruleanBlue-100">
              Internal Links
            </h3>
            <ul>
              <FooterItem href="/verifier">Contract Verifier</FooterItem>
              <FooterItem href="/lookup">Contract Fetcher</FooterItem>
              <FooterItem href="">Status Page</FooterItem>
              <FooterItem href="">About</FooterItem>
            </ul>
          </div>
          <div>
            <h3 className="uppercase font-bold text-ceruleanBlue-100">
              External Links
            </h3>
            <ul>
              <FooterItem href="">Documentation</FooterItem>
              <FooterItem href="">IPFS Gateway</FooterItem>
              <FooterItem href="">Media Kit</FooterItem>
            </ul>
          </div>
          <div>
            <h3 className="uppercase font-bold text-ceruleanBlue-100">
              Socials
            </h3>
            <ul>
              <FooterItem href="">Twitter / Fosstodon</FooterItem>
              <FooterItem href="">Gitter / Matrix </FooterItem>
              <FooterItem href="">Github</FooterItem>
            </ul>
          </div>
        </nav>
        <div className="text-center text-sm mt-8 text-ceruleanBlue-300">
          Sourcify Team • {new Date().getFullYear()} • sourcify.eth{" "}
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

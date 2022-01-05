import ReactTooltip from "react-tooltip";
import { ReactComponent as Github } from "../../assets/icons/github.svg";
import { ReactComponent as Gitter } from "../../assets/icons/gitter.svg";
import { ReactComponent as Matrix } from "../../assets/icons/matrix.svg";
import { ReactComponent as Twitter } from "../../assets/icons/twitter.svg";
import logoText from "../../assets/logo-rounded.svg";
import { IPFS_IPNS_GATEWAY_URL } from "../../constants";

const Header = () => {
  return (
    <header className="flex justify-between py-4 md:py-6 w-auto">
      <ReactTooltip effect="solid" />
      <div>
        <a href="/" className="flex items-center">
          <img
            src={logoText}
            alt="Sourcify logo"
            className="max-h-8 md:max-h-10"
          />
          <span className="ml-3 text-gray-700 font-mono text-xl md:text-2xl">
            sourcify
          </span>
        </a>
      </div>
      <div className="flex items-center">
        <nav className="font-mono text-xl text-gray-700">
          <a
            className="px-2 py-2 md:px-6 hover:text-ceruleanBlue-600 hover:underline decoration-lightCoral-500 decoration-2 "
            href={IPFS_IPNS_GATEWAY_URL}
            target="_blank"
            rel="noreferrer"
          >
            IPFS
          </a>
          <a
            className="px-2 py-2 md:px-6 hover:text-ceruleanBlue-600 hover:underline decoration-lightCoral-500 decoration-2 "
            href="/docs"
            target="_blank"
            rel="noreferrer"
          >
            Docs
          </a>
        </nav>
        {/* Icons */}
        <div className="flex items-center md:ml-8">
          <a
            className="px-2"
            href="https://github.com/ethereum/sourcify"
            target="_blank"
            rel="noreferrer"
            data-tip="Github"
          >
            <Github className="h-4 md:h-6 w-auto fill-gray-700 hover:fill-ceruleanBlue-500" />
          </a>
          <a
            className="px-2"
            href="https://twitter.com/sourcifyeth"
            target="_blank"
            rel="noreferrer"
            data-tip="Twitter"
          >
            <Twitter className="h-4 md:h-6 w-auto fill-gray-700 hover:fill-ceruleanBlue-500" />
          </a>
          <a
            className="px-2"
            href="https://gitter.im/ethereum/source-verify"
            target="_blank"
            rel="noreferrer"
            data-tip="Gitter"
          >
            <Gitter className="h-4 md:h-6 w-auto fill-gray-700 hover:fill-ceruleanBlue-500" />
          </a>
          <a
            className="pl-2"
            href="https://matrix.to/#/#ethereum_source-verify:gitter.im"
            target="_blank"
            rel="noreferrer"
            data-tip="Matrix chat"
          >
            <Matrix className="h-4 md:h-6 w-auto fill-gray-700 hover:fill-ceruleanBlue-500" />
          </a>
        </div>
      </div>
    </header>
  );
};

export default Header;

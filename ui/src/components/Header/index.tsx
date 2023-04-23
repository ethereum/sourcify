import { useState } from "react";
import { HiMenu } from "react-icons/hi";
import { Link } from "react-router-dom";
import ReactTooltip from "react-tooltip";
import { ReactComponent as Matrix } from "../../assets/icons/matrix.svg";
import { ReactComponent as Twitter } from "../../assets/icons/twitter.svg";
import logoText from "../../assets/logo-rounded.svg";
import { DOCS_URL, PLAYGROUND_URL } from "../../constants";

const Header = () => {
  const [showNav, setShowNav] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768); // tailwind md=768px
  window.addEventListener("resize", () => {
    setIsDesktop(window.innerWidth > 768);
  });

  const toggleNav = () => {
    setShowNav((prev) => !prev);
  };
  return (
    <header className="flex justify-between py-4 md:py-6 w-auto flex-wrap md:flex-nowrap">
      <ReactTooltip effect="solid" />
      <div className="flex items-center">
        <Link to="/" className="flex items-center">
          <img src={logoText} alt="Sourcify logo" className="max-h-10" />
          <span className="ml-3 text-gray-700 font-vt323 text-2xl">
            sourcify.eth
          </span>
        </Link>
      </div>
      <button className="block md:hidden" onClick={toggleNav}>
        <HiMenu className="text-gray-700 text-3xl hover:text-ceruleanBlue-500" />
      </button>
      {/* A div to break flex into new line */}
      <div className="h-0 basis-full"></div>
      <div
        className={`${
          showNav || isDesktop ? "flex" : "hidden"
        } items-center justify-center md:justify-end text-center flex-col md:flex-row w-full mt-4 md:mt-0`}
      >
        <nav
          className={`${
            showNav || isDesktop ? "flex" : "hidden"
          } font-vt323 text-2xl text-gray-700 flex-col md:flex-row`}
        >
          <Link
            className="link-underline mx-2 my-2 md:mx-6 hover:text-ceruleanBlue-500"
            to="/verifier"
          >
            Verify
          </Link>
          <Link
            className="link-underline mx-2 my-2 md:mx-6 hover:text-ceruleanBlue-500"
            to="/lookup"
          >
            Lookup
          </Link>
          <a
            className="link-underline mx-2 my-2 md:mx-6 hover:text-ceruleanBlue-500"
            href={DOCS_URL}
          >
            Docs
          </a>
          <a
            className="link-underline mx-2 my-2 md:mx-6 hover:text-ceruleanBlue-500"
            href={PLAYGROUND_URL}
          >
            Playground
          </a>
          <div className="flex items-center ml-2">
            <iframe
              src="https://ghbtns.com/github-btn.html?user=ethereum&repo=sourcify&type=star&count=true&size=large"
              // frameborder="0"
              scrolling="0"
              width="135"
              height="30"
              title="GitHub"
              className=""
            ></iframe>
          </div>
        </nav>
        {/* Icons */}
        <div className="flex items-center ml-2 mt-6 md:mt-0">
          <a
            className="px-2 hover-to-fill"
            href="https://twitter.com/sourcifyeth"
            data-tip="Twitter"
          >
            <Twitter className="h-[1.4rem] w-auto fill-gray-700 500" />
          </a>
          <a
            className="pl-2 hover-to-fill"
            href="https://matrix.to/#/#ethereum_source-verify:gitter.im"
            data-tip="Matrix chat"
          >
            <Matrix className="h-6 w-auto fill-gray-700 hover:fill-ceruleanBlue-500" />
          </a>
        </div>
        {/* <Link
          className="link-underline ml-2 mb-2 mt-6 md:mt-2 md:ml-6 hover:text-ceruleanBlue-500"
          to="/status"
          data-tip="Server status: working"
        >
          <span className="inline md:hidden">Server status: </span> ✅
        </Link> */}
      </div>
    </header>
  );
};

export default Header;

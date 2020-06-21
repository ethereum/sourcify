import React from "react";
import GithubIcon from "../icons/GithubIcon";
import TwitterIcon from "../icons/TwitterIcon";

const Header: React.FC = () => {
  return (
    <>
      <header className="header">
        <a href="">
          <img src="../../../public/logo.svg" alt="logo" />
        </a>
        <div className="header__social-icons">
          <a href="">
            <TwitterIcon />
          </a>
          <a href="">
            <GithubIcon />
          </a>
        </div>
      </header>
    </>
  );
};

export default Header;

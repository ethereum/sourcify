import React from "react";
import {GithubIcon, GitterIconOutlined, TwitterIcon} from "../icons";
import {GITHUB_URL, GITTER_URL, TWITTER_URL} from "../../common/constants";

const Header: React.FC = () => {
    return (
        <header className="header">
            <a href="/">
                <img src="../../../logo.svg" alt="logo"/>
            </a>
            <div className="header__social-icons">
                <a href={TWITTER_URL}>
                    <TwitterIcon/>
                </a>
                <a href={GITHUB_URL}>
                    <GithubIcon/>
                </a>
                <a href={GITTER_URL}>
                    <GitterIconOutlined/>
                </a>
            </div>
        </header>
    );
};

export default Header;

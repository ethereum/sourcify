import React from "react";

import "./styles/app.scss";
import MainLayout from "./components/layout/MainLayout";

const App: React.FC = () => {
  return (
    <div id="app" className="grid">
      <MainLayout>
        <div className="container">
          <div className="container__left">
            <h1 className="main-title">
              Decentralized Metadata and Source Code Repository
            </h1>
            <h3 className="sub-title">
              Make the most of your Solidity code with metadata files and source
              verifcation.
            </h3>
            <div className="description">
              <p className="description__text">
                Sourcify is a decentralized automated contract verification
                service, which makes publishing and verifying source code easy.
              </p>
              <ol className="description__steps">
                <li>Choose network from dropdown menu</li>
                <li>Input contract address</li>
                <li>
                  Upload all metadata and contract files that you want to verify
                  via the dropzone
                </li>
              </ol>
              <p className="description__text">
                Together with the compilation metadata, everyone can re-compile
                the smart contract and be sure that the source code is exactly
                the same as at deploy time, including every comment.
              </p>
              <p className="description__text">
                You can use this platform to obtain the ABI for each contract.
              </p>
            </div>
            <div className="bottom">
              <p>
                Browse contract repository <a href="">here</a> or via the <a href="">ipfs/ipns gateway</a>.
              </p>
              <p>
                Not sure what all of this is for? Learn why source verification
                matters <a href="">here</a>.
              </p>
              <p>Problems or questions? Ask us anything on <a href="">Gitter!</a></p>
            </div>
          </div>
          <div className="container__right">RIGHT</div>
        </div>
      </MainLayout>
    </div>
  );
};

export default App;

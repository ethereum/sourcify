import React from "react";
import circle from "./logo/etherscan-logo-circle.svg";
import circleLight from "./logo/etherscan-logo-light-circle.svg";

type EtherscanLogoProps = {
  light: boolean;
};

const EtherscanLogo: React.FC<EtherscanLogoProps> = ({ light }) => {
  let src;
  if (!light) {
    src = circle;
  } else {
    src = circleLight;
  }
  return (
    <img
      style={{ width: "13px" }}
      className="inline align-middle mr-1"
      alt="Logo"
      src={src}
    />
  );
};

export default EtherscanLogo;

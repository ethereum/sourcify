import optimism from "./assets/chains/optimism.svg";
import gnosisSafe from "./assets/contracts/gnosisSafe.svg";
import synthetix from "./assets/contracts/synthetix.png";
import uniswap from "./assets/contracts/uniswap.png";

const featured = [
  {
    name: "Uniswap",
    href: "https://repo.sourcify.dev/contracts/full_match/1/0x1F98431c8aD98523631AE4a59f267346ea31F984/",
    logo: uniswap,
    displayed: true,
  },
  {
    name: "Synthetix",
    href: "https://repo.sourcify.dev/contracts/full_match/10/0x06C6D063896ac733673c4474E44d9268f2402A55/",
    logo: synthetix,
    displayed: true,
  },
  {
    name: "Optimism",
    href: "https://repo.sourcify.dev/contracts/full_match/1/0x5e4e65926ba27467555eb562121fac00d24e9dd2/",
    logo: optimism,
    displayed: true,
  },
  {
    name: "Gnosis Safe",
    href: "https://repo.sourcify.dev/contracts/full_match/1/0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552/",
    logo: gnosisSafe,
    displayed: true,
  },
];

export default featured;

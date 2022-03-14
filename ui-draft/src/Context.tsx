import React, { createContext, ReactElement, useEffect, useState } from "react";
import { Chain, ChainMap } from "./types";
import { getSourcifyChains } from "./utils/api";

interface ContextInterface {
  sourcifyChains: Chain[];
  sourcifyChainMap: ChainMap;
}

// create context
const Context = createContext<ContextInterface>({
  sourcifyChains: [],
  sourcifyChainMap: {},
});

const ContextProvider = ({ children }: { children: ReactElement }) => {
  const [sourcifyChains, setSourcifyChains] = useState<Chain[]>([]);
  const [sourcifyChainMap, setSourcifyChainMap] = useState<ChainMap>({});

  // Fetch and assign the chains
  useEffect(() => {
    getSourcifyChains()
      .then((sourcifyChains) => {
        setSourcifyChains(sourcifyChains);
        const chainMap = sourcifyChains.reduce<ChainMap>(function (
          acc,
          currentChain
        ) {
          acc[currentChain.chainId] = currentChain;
          return acc;
        },
        {});
        setSourcifyChainMap(chainMap);
      })
      .catch((err) => {
        alert("Can't fetch Sourcify chains from the server!");
        console.log(err);
      });
  }, []);

  return (
    // the Provider gives access to the context to its children
    <Context.Provider value={{ sourcifyChains, sourcifyChainMap }}>
      {children}
    </Context.Provider>
  );
};

export { Context, ContextProvider };

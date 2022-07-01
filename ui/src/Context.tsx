import React, { createContext, ReactElement, useEffect, useState } from "react";
import { Chain, ChainMap } from "./types";
import { getSourcifyChains } from "./utils/api";

interface ContextInterface {
  sourcifyChains: Chain[];
  sourcifyChainMap: ChainMap;
  errorMessage: string | ReactElement;
  setErrorMessage: React.Dispatch<React.SetStateAction<string | ReactElement>>;
}

// create context
const Context = createContext<ContextInterface>({
  sourcifyChains: [],
  sourcifyChainMap: {},
  errorMessage: "",
  setErrorMessage: () => null,
});

const ContextProvider = ({ children }: { children: ReactElement }) => {
  const [sourcifyChains, setSourcifyChains] = useState<Chain[]>([]);
  const [sourcifyChainMap, setSourcifyChainMap] = useState<ChainMap>({});
  const [errorMessage, setErrorMessage] = useState<string | ReactElement>("");

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
        setErrorMessage("Can't fetch Sourcify chains from the server!");
        console.log(err);
      });
  }, []);

  return (
    // the Provider gives access to the context to its children
    <Context.Provider
      value={{
        sourcifyChains,
        sourcifyChainMap,
        errorMessage,
        setErrorMessage,
      }}
    >
      {children}
    </Context.Provider>
  );
};

export { Context, ContextProvider };

import React, { useContext } from "react";
import { Context } from "../../Context";
import "./style.css";
import { fuzzySearch } from "../fuzzySearch";
import SelectSearch, { SelectSearchProps } from "react-select-search";

type ChainSelectProps = {
  value: string | undefined;
  handleChainIdChange: SelectSearchProps["onChange"];
  id?: string;
  availableChains?: number[];
};

export default function ChainSelect({
  value,
  handleChainIdChange,
  id,
  availableChains,
}: ChainSelectProps) {
  const { sourcifyChains } = useContext(Context);

  let filteredChains;
  if (availableChains) {
    // Explicitly define which chains to show, like in Etherscan chains
    filteredChains = sourcifyChains.filter((chain) =>
      availableChains.includes(chain.chainId)
    );
  } else {
    filteredChains = sourcifyChains.filter((chain) => chain.supported);
  }

  return (
    <SelectSearch
      onChange={handleChainIdChange}
      value={value}
      options={filteredChains.map((chain) => ({
        name: `${chain.name || chain.title} (${chain.chainId}) `,
        value: chain.chainId,
      }))}
      search
      id={id}
      filterOptions={fuzzySearch}
      emptyMessage="Couldn't fetch Sourcify chains"
      placeholder="Choose chain"
    />
  );
}

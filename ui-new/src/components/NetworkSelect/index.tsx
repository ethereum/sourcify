import Fuse from "fuse.js";
import React from "react";
import SelectSearch, {
  SelectSearchOption,
  SelectSearchProps,
} from "react-select-search";
import { CHAIN_OPTIONS } from "../../constants";
import "./style.css";

// Fix incorrect value field type of onChange. Should be string and not SelectedOptionValue
type WithoutOnChange = Omit<SelectSearchProps, "onChange">; // Remove prop
// Add correct onChange prop type
type ModifiedSelectSearchProps = WithoutOnChange & {
  onChange: (value: number) => void;
};
// Typecast. Don't cast with "SelectSearch as unknown as FC<Modified>" to not lose the types other than onChange.
const CustomSelectSearch =
  SelectSearch as React.FC<WithoutOnChange> as React.FC<ModifiedSelectSearchProps>;

function fuzzySearch(options: SelectSearchOption[]) {
  const fuse = new Fuse(options, {
    keys: ["name", "groupName", "items.name"],
    threshold: 0.6,
  });
  return (value: string) => {
    if (!value.length) {
      return options;
    }
    return fuse
      .search(value)
      .map((res: Fuse.FuseResult<SelectSearchOption>) => res.item);
  };
}
type NetworkSelectProps = {
  value: string | undefined;
  handleChainIdChange: (chainId: number) => void;
};

export default function NetworkSelect({
  value,
  handleChainIdChange,
}: NetworkSelectProps) {
  return (
    <CustomSelectSearch
      onChange={handleChainIdChange}
      value={value}
      options={CHAIN_OPTIONS.map((chain) => ({
        name: `#${chain.id} ${chain.label}`,
        value: chain.id,
      }))}
      search
      filterOptions={fuzzySearch}
      emptyMessage="Not found"
      placeholder="Choose network"
    />
  );
}

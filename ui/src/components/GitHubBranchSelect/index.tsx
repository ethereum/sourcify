import Fuse from "fuse.js";
import React, { useEffect, useState } from "react";
import SelectSearch, {
  SelectSearchOption,
  SelectSearchProps,
} from "react-select-search";
import "./style.css";

// Fix incorrect value field type of onChange. Should be string and not SelectedOptionValue
type WithoutOnChange = Omit<SelectSearchProps, "onChange">; // Remove prop
// Add correct onChange prop type
type ModifiedSelectSearchProps = WithoutOnChange & {
  onChange: (value: string) => void;
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
type GitHubBranchSelectProps = {
  repository: string;
  value: string | undefined;
  handleBranchChange: (branch: string) => void;
  handleBranchesLoaded: (success: boolean) => void;
  id?: string;
};

export default function GitHubBranchSelect({
  repository,
  value,
  handleBranchChange,
  handleBranchesLoaded,
  id,
}: GitHubBranchSelectProps) {
  const [branches, setBranches] = useState<any[]>([]);

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const request = await fetch(
          `https://api.github.com/repos/${repository}/branches`
        );
        const result = await request.json();
        if (Array.isArray(result)) {
          setBranches(result);
          handleBranchesLoaded(true);
        } else {
          setBranches([]);
          handleBranchesLoaded(false);
        }
      } catch (e) {
        setBranches([]);
        handleBranchesLoaded(false);
      }
    };
    if (repository !== "") {
      fetchBranches();
    } else {
      setBranches([]);
      handleBranchesLoaded(false);
    }
  }, [repository, handleBranchesLoaded]);

  return (
    <CustomSelectSearch
      onChange={handleBranchChange}
      value={value}
      options={branches.map((branch) => ({
        name: branch.name,
        value: branch.name,
      }))}
      search
      id={id}
      filterOptions={fuzzySearch}
      emptyMessage={`Repo '${repository}' doesn't exists`}
      placeholder="Choose branch"
    />
  );
}

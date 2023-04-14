import React, { useEffect, useState } from "react";
import SelectSearch, { SelectSearchProps } from "react-select-search";
import "./style.css";
import { fuzzySearch } from "../fuzzySearch";

type GitHubBranchSelectProps = {
  repository: string;
  value: string | undefined;
  handleBranchChange: SelectSearchProps["onChange"];
  handleBranchesLoaded: (error?: GitHubBranchSelectError) => void;
  id?: string;
};

export enum GitHubBranchSelectError {
  RATE_LIMIT,
  NOT_FOUND,
  NO_REPO_NAME,
  UNKNOWN,
}

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
          handleBranchesLoaded();
        } else {
          setBranches([]);
          if (result.message === "Not Found") {
            handleBranchesLoaded(GitHubBranchSelectError.NOT_FOUND);
          } else {
            handleBranchesLoaded(GitHubBranchSelectError.RATE_LIMIT);
          }
        }
      } catch (e) {
        setBranches([]);
        handleBranchesLoaded(GitHubBranchSelectError.UNKNOWN);
      }
    };
    if (repository !== "") {
      fetchBranches();
    } else {
      setBranches([]);
      handleBranchesLoaded(GitHubBranchSelectError.NO_REPO_NAME);
    }
  }, [repository, handleBranchesLoaded]);

  return (
    <SelectSearch
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

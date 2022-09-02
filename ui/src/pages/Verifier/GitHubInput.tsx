import { useState } from "react";
import GitHubBranchSelect from "../../components/GitHubBranchSelect";
import Input from "../../components/Input";
import { ADD_FILES_URL } from "../../constants";
import { SessionResponse } from "../../types";

let timeoutId: any;

function debounce(fn: Function, time: number) {
  return wrapper;
  function wrapper(...args: any) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      timeoutId = null;
      fn(...args);
    }, time);
  }
}

type GitHubInputProps = {
  fetchAndUpdate: (
    URL: string,
    fetchOptions?: RequestInit
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
};
const GitHubInput = ({
  fetchAndUpdate,
  setIsLoading,
  isLoading,
}: GitHubInputProps) => {
  const [repo, setRepo] = useState<string>("");
  const [branch, setBranch] = useState<string>("");
  const [showBranchSelect, setShowBranchSelect] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const generateUrlAndSubmit = (branch: string) => {
    const url = `https://github.com/${repo}/archive/refs/heads/${branch}.zip`;
    let zipUrl;

    try {
      // Add trailing slash to e.target.value i.e. example.com ==> example.com/
      zipUrl = new URL(url).href;
      setIsLoading(true);
    } catch (_) {
      return setError("Enter a valid URL");
    }
    fetchAndUpdate(ADD_FILES_URL + "?url=" + zipUrl, {
      method: "POST",
    }).finally(() => {
      setIsLoading(false);
    });
  };

  const handleRepoChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();
    debounce(() => {
      setRepo(e.target.value);
    }, 600)();
  };

  const handleBranchChange = (id: string) => {
    setBranch(id);
    generateUrlAndSubmit(id);
    if (!id) return setError("");
  };

  const handleBranchesLoaded = (success: boolean) => {
    if (success) {
      setShowBranchSelect(true);
    } else {
      setShowBranchSelect(false);
    }
  };

  return (
    <>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        onChange={handleRepoChange}
        placeholder="Repository name (Uniswap/v3-core)"
        className="mb-2"
      />

      <div className={!showBranchSelect ? "hidden" : ""}>
        <GitHubBranchSelect
          repository={repo}
          value={branch}
          handleBranchChange={handleBranchChange}
          handleBranchesLoaded={handleBranchesLoaded}
        />
      </div>
    </>
  );
};

export default GitHubInput;

import { useState } from "react";
import GitHubBranchSelect from "../../components/GitHubBranchSelect";
import Input from "../../components/Input";
import { ADD_FILES_URL } from "../../constants";
import { SessionResponse } from "../../types";

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
  const [error, setError] = useState<string>("");

  const generateUrlAndSubmit = () => {
    const url = "ciao";
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
    setRepo(e.target.value);
    if (!e.target.value) return setError("");
  };

  const handleBranchChange = (id: string) => {
    setBranch(id);
    if (!id) return setError("");
  };

  return (
    <>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        value={repo}
        onChange={handleRepoChange}
        placeholder="Uniswap/v3-core"
      />
      <GitHubBranchSelect
        repository={repo}
        value={branch}
        handleBranchChange={handleBranchChange}
      />
    </>
  );
};

export default GitHubInput;

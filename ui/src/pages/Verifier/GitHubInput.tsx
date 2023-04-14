import { useCallback, useState } from "react";
import GitHubBranchSelect, {
  GitHubBranchSelectError,
} from "../../components/GitHubBranchSelect";
import Input from "../../components/Input";
import { ADD_FILES_URL } from "../../constants";
import { SessionResponse } from "../../types";
import { SelectSearchProps, SelectedOptionValue } from "react-select-search";

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
      if (e.target.value !== "" && e.target.value.startsWith("http")) {
        try {
          let [, , , username, project] = e.target.value.split("/");
          if (project.endsWith(".git")) {
            project = project.replace(".git", "");
          }
          setRepo(`${username}/${project}`);
        } catch (e) {}
      } else {
        setRepo(e.target.value);
        setError("");
      }
    }, 600)();
  };

  const handleBranchChange: SelectSearchProps["onChange"] = (
    selectedOptionValue
  ) => {
    const id = `${selectedOptionValue as SelectedOptionValue}`;
    setBranch(id);
    generateUrlAndSubmit(id);
    if (!id) return setError("");
  };

  const handleBranchesLoaded = useCallback(
    (error?: GitHubBranchSelectError) => {
      if (error === undefined) {
        setShowBranchSelect(true);
        setError("");
      } else {
        setShowBranchSelect(false);
        switch (+error) {
          case GitHubBranchSelectError.NO_REPO_NAME:
            return setError("");
          case GitHubBranchSelectError.NOT_FOUND:
            return setError("Repository not found");
          case GitHubBranchSelectError.RATE_LIMIT:
            return setError("GitHub API Rate limit ");
          default:
            return setError("Unknow error fetching the branches");
        }
      }
    },
    []
  );

  return (
    <>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        onChange={handleRepoChange}
        placeholder="Repository name or repository url"
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

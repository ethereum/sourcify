import { useState, useEffect, useContext, useCallback } from "react";
import Input from "../../components/Input";
import ChainSelect from "../../components/ChainSelect";
import { ADD_SOLC_JSON_URL } from "../../constants";
import { SessionResponse } from "../../types";
import { Context } from "../../Context";
import { isAddress } from "@ethersproject/address";
import SelectSearch, {
  SelectSearchProps,
  SelectedOptionValue,
} from "react-select-search";
import { fuzzySearch } from "react-select-search";

const SOLC_VERSIONS_LIST_URL =
  "https://raw.githubusercontent.com/ethereum/solc-bin/gh-pages/bin/list.txt";

type SolcJsonInputProps = {
  fetchAndUpdate: (
    URL: string,
    fetchOptions?: RequestInit
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
};
const SolcJsonInput = ({
  fetchAndUpdate,
  setIsLoading,
  isLoading,
}: SolcJsonInputProps) => {
  const [chosenCompilerVersion, setChosenCompilerVersion] =
    useState<string>("");
  const [error, setError] = useState<string>("");
  const [officialCompilerVersionsList, setOfficialCompilerVersionsList] =
    useState<string[]>();
  const [allCompilerVersionsList, setAllCompilerVersionsList] =
    useState<string[]>();
  const [useNightlies, setUseNightlies] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleCompilerVersionChange: SelectSearchProps["onChange"] = (
    selectedOptionValue
  ) => {
    const selectedCompilerVersion = `${
      selectedOptionValue as SelectedOptionValue
    }`;
    setChosenCompilerVersion(selectedCompilerVersion);
  };

  const formatVersionName = (version: string) => {
    return version.replace("soljson-", "").replace(".js", "");
  };

  useEffect(() => {
    if (!chosenCompilerVersion) {
      return setError("Please select a compiler version");
    }
    if (!selectedFile) {
      return setError("Please select a file");
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("files", selectedFile);
    formData.append("compilerVersion", chosenCompilerVersion);

    fetchAndUpdate(ADD_SOLC_JSON_URL, {
      method: "POST",
      body: formData,
    }).finally(() => {
      setIsLoading(false);
    });
  }, [chosenCompilerVersion, selectedFile, setIsLoading, fetchAndUpdate]);

  useEffect(() => {
    setIsLoading(true);
    fetch(SOLC_VERSIONS_LIST_URL)
      .then((response) => response.text())
      .then(async (text) => {
        const allVersionsList = text
          .split("\n")
          .map((line) => formatVersionName(line)); // strip solc- and .js parts
        setAllCompilerVersionsList(allVersionsList);
        setOfficialCompilerVersionsList(
          allVersionsList.filter((version) => !version.includes("nightly"))
        );
        setIsLoading(false);
      })
      .catch((error) => {
        console.error(error);
        setIsLoading(false);
        setError("Failed to fetch compiler versions");
      });
  }, []);

  const returnCompilerOptions = (): { name: string; value: string }[] => {
    if (useNightlies) {
      if (!allCompilerVersionsList) {
        return [];
      }
      return allCompilerVersionsList.map((version) => ({
        name: version,
        value: version,
      }));
    } else {
      if (!officialCompilerVersionsList) {
        return [];
      }
      return officialCompilerVersionsList.map((version) => ({
        name: version,
        value: version,
      }));
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setSelectedFile(file || null);
  };

  return (
    <div>
      <input
        type="checkbox"
        id="nightlies"
        checked={useNightlies}
        onChange={() => setUseNightlies(!useNightlies)}
      />{" "}
      <label htmlFor="nightlies">Use nightlies</label>
      <SelectSearch
        onChange={handleCompilerVersionChange}
        value={chosenCompilerVersion}
        options={returnCompilerOptions()}
        search
        filterOptions={fuzzySearch}
        emptyMessage="Couldn't fetch compiler versions"
        placeholder="Choose a compiler version"
      />
      <input type="file" onChange={handleFileChange} />
    </div>
  );
};

export default SolcJsonInput;

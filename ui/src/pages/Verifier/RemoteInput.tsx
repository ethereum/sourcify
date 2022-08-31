import { useState } from "react";
import Input from "../../components/Input";
import { ADD_FILES_URL } from "../../constants";
import { SessionResponse } from "../../types";

type RemoteInputProps = {
  fetchAndUpdate: (
    URL: string,
    fetchOptions?: RequestInit
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
};
const RemoteInput = ({
  fetchAndUpdate,
  setIsLoading,
  isLoading,
}: RemoteInputProps) => {
  const [url, setUrl] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleUrlChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    console.log(e.target.value);
    e.preventDefault();
    setUrl(e.target.value);
    let zipUrl;
    if (!e.target.value) return setError("");
    try {
      // Add trailing slash to e.target.value i.e. example.com ==> example.com/
      zipUrl = new URL(e.target.value).href;
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
  return (
    <>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        value={url}
        onChange={handleUrlChange}
        placeholder="https://github.com/Uniswap/v3-core/archive/refs/heads/main.zip"
      />
    </>
  );
};

export default RemoteInput;

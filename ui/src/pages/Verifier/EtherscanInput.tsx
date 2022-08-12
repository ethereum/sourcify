import { useState, useEffect } from "react";
import Input from "../../components/Input";
import NetworkSelect from "../../components/NetworkSelect";
import { VERIFY_FROM_ETHERSCAN } from "../../constants";
import { SessionResponse } from "../../types";

type EtherscanInputProps = {
  fetchAndUpdate: (
    URL: string,
    fetchOptions?: RequestInit
  ) => Promise<SessionResponse | undefined>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  isLoading: boolean;
};
const EtherscanInput = ({
  fetchAndUpdate,
  setIsLoading,
  isLoading,
}: EtherscanInputProps) => {
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleAddressChange: React.ChangeEventHandler<HTMLInputElement> = (
    e
  ) => {
    e.preventDefault();
    setAddress(e.target.value);
    if (!e.target.value) return setError("");
  };

  const handleChainIdChange = (id: number) => {
    const chainId = `${id}`;
    setChainId(chainId);
    if (chainId) return setError("");
  };

  useEffect(() => {
    if (address === "" || chainId === "") {
      return;
    }
    setIsLoading(true);
    const formData = new FormData();
    formData.append("address", address);
    formData.append("chainId", chainId);

    fetchAndUpdate(VERIFY_FROM_ETHERSCAN, {
      method: "POST",
      body: formData,
    }).finally(() => {
      setAddress("");
      setChainId("");
      setIsLoading(false);
    });
  }, [address, chainId, fetchAndUpdate, setIsLoading]);

  return (
    <>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        value={address}
        onChange={handleAddressChange}
        placeholder="0x00878Ac0D6B8d981ae72BA7cDC967eA0Fae69df4"
      />
      <NetworkSelect
        value={chainId}
        handleChainIdChange={handleChainIdChange}
        availableChains={[1, 5, 42, 4, 3, 11155111]}
      />
    </>
  );
};

export default EtherscanInput;

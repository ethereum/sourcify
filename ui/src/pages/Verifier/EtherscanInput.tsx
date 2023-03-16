import { useState, useEffect, useContext } from "react";
import Input from "../../components/Input";
import ChainSelect from "../../components/ChainSelect";
import { VERIFY_FROM_ETHERSCAN } from "../../constants";
import { SessionResponse } from "../../types";
import { Context } from "../../Context";

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
  const { sourcifyChains, sourcifyChainMap } = useContext(Context);
  const chainsIdsWithEtherscanAPI = sourcifyChains
    .filter((chain) => chain.etherscanAPI)
    .map((chainId) => chainId.chainId);

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
    <div className="mb-2">
      {error && <div className="text-sm text-red-400">{error}</div>}
      <Input
        disabled={isLoading}
        value={address}
        onChange={handleAddressChange}
        placeholder="0x00878Ac0D6B8d9..."
        className="mb-2"
      />
      <ChainSelect
        value={chainId}
        handleChainIdChange={handleChainIdChange}
        availableChains={chainsIdsWithEtherscanAPI}
      />
      {sourcifyChainMap[parseInt(chainId)]?.etherscanAPI && (
        <div className="mt-1">
          <p className="text-xs text-gray-400 text-right">
            Powered by {sourcifyChainMap[parseInt(chainId)]?.etherscanAPI} APIs
          </p>
        </div>
      )}
    </div>
  );
};

export default EtherscanInput;

import { useContext, useEffect, useState } from "react";
import Header from "../../components/Header";
import Toast from "../../components/Toast";
import { Context } from "../../Context";
import { CheckAllByAddressResult } from "../../types";
import { checkAllByAddresses } from "../../utils/api";
import Field from "./Field";
import Result from "./Result";
import { useParams, useNavigate } from "react-router-dom";
import { isAddress, getAddress } from "@ethersproject/address";

const Lookup = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CheckAllByAddressResult | undefined>(
    undefined
  );
  const { address } = useParams();
  const { sourcifyChains, errorMessage, setErrorMessage } = useContext(Context);

  const handleRequest = async (_address: string) => {
    if (!sourcifyChains?.length) {
      return;
    }
    setLoading(true);
    try {
      const result = await checkAllByAddresses(
        _address,
        `0,${sourcifyChains.map((c) => c.chainId.toString()).join(",")}`
      );
      const currentAddressMatches = result.find(
        (match) => (match.address = _address)
      );
      setResponse(currentAddressMatches);
      navigate(`/lookup/${_address}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred, try again!");
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />;
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setResponse(undefined);
    navigate(`/lookup`);
  };

  useEffect(() => {
    if (address && address !== response?.address) {
      if (!isAddress(address)) {
        return;
      }
      // Get checksummed format
      const checksummedAddress = getAddress(address);
      handleRequest(checksummedAddress);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourcifyChains, address]);

  return (
    <div className="flex flex-col flex-grow pb-8 px-8 md:px-12 lg:px-24 bg-gray-100">
      <Header />
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Contract Lookup</h1>
        <p className="mt-2">
          Look for verified contracts in the Sourcify repository
        </p>
      </div>
      <div className="flex flex-col flex-grow items-center justify-center mt-6">
        <div className="pt-1 bg-ceruleanBlue-500 flex w-full rounded-xl mx-2 mb-4 md:mb-0">
          {!!response ? (
            <Result response={response} goBack={goBack} />
          ) : (
            <Field loading={loading} handleRequest={handleRequest} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Lookup;

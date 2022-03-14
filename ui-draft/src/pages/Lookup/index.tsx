import { useContext, useState } from "react";
import Header from "../../components/Header";
import Toast from "../../components/Toast";
import { Context } from "../../Context";
import { CheckAllByAddressResult } from "../../types";
import { checkAllByAddresses } from "../../utils/api";
import Field from "./Field";
import Result from "./Result";

const Lookup = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CheckAllByAddressResult | undefined>(
    undefined
  );
  const { sourcifyChains, errorMessage, setErrorMessage } = useContext(Context);

  const handleRequest = async (address: string) => {
    setLoading(true);
    try {
      const result = await checkAllByAddresses(
        address,
        sourcifyChains.map((c) => c.chainId.toString()).join(",")
      );
      console.log(result);
      const currentAddressMatches = result.find(
        (match) => (match.address = address)
      );
      setResponse(currentAddressMatches);
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
            <Result response={response} setResponse={setResponse} />
          ) : (
            <Field loading={loading} handleRequest={handleRequest} />
          )}
        </div>
      </div>
    </div>
  );
};

export default Lookup;

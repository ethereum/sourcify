import { useState } from "react";
import Header from "../../components/Header";
import Field from "./Field";
import Result from "./Result";
import Toast from "../../components/Toast";
import { checkAllByAddresses } from "../../utils/api";
import { CheckAllByAddressResult } from "../../types";
import { CHAIN_IDS_STR } from "../../constants";


const Fetcher = () => {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [response, setResponse] = useState<CheckAllByAddressResult | undefined>(undefined);

  const handleRequest = async (address: string) => {
    setLoading(true)
    try {
      const result = await checkAllByAddresses(address, CHAIN_IDS_STR);
      const currentAddressMatches = result.find(
        (match) => (match.address = address)
      );
      setResponse(currentAddressMatches)
    } catch (err) {
      setErrorMessage("An error occurred, try again!");
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 pb-8 px-8 md:px-12 lg:px-24 h-full">
      <Header />
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Fetcher</h1>
        <p className="mt-2">
          Check if the contract at the given address and chain is verified on Sourcify
        </p>
      </div>
      <div className="flex flex-col h-full justify-center md:flex-row flex-grow mt-6">
        <div className="pt-1 min-h-96 bg-ceruleanBlue-500 flex w-3/5 rounded-xl mx-2 mb-4 md:mb-0">
          {!!response ? <Result response={response} setResponse={setResponse} /> : <Field loading={loading} handleRequest={handleRequest} />}
        </div>
      </div>
    </div>
  )
};

export default Fetcher;

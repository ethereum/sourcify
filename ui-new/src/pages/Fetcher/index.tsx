import { useState } from "react";
import Header from "../../components/Header";
import Field from "./Field";
import Toast from "../../components/Toast";


const Fetcher = () => {
  const [errorMessage, setErrorMessage] = useState<string>("");
  
  const [response, setResponse] = useState(null); // TODO: type this later
  const [loading, setLoading] = useState<boolean>(false);

  const handleRequest = async (address: string) => {
    setLoading(true)
    console.log(address)
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
          <Field loading={loading} handleRequest={handleRequest} />
        </div>
      </div>
    </div>
  )
};

export default Fetcher;

import { useEffect, useState } from "react";
import Header from "../../components/Header";
import Toast from "../../components/Toast";
import {
  ADD_FILES_URL,
  RESTART_SESSION_URL,
  SESSION_DATA_URL,
  VERIFY_VALIDATED_URL,
} from "../../constants";
import {
  DropzoneFile,
  IGenericError,
  IResponseError,
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../types";
import CheckedContractsView from "./CheckedContractsView";
import FileUpload from "./FileUpload";

const Verifier: React.FC = () => {
  const [addedFiles, setAddedFiles] = useState<string[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [checkedContracts, setCheckedContracts] = useState<SendableContract[]>(
    []
  );
  const [errorMessage, setErrorMessage] = useState<string>("");

  useEffect(() => {
    fetchAndUpdate(SESSION_DATA_URL);
  }, []);

  const fetchAndUpdate = async (URL: string, fetchOptions?: RequestInit) => {
    try {
      const rawRes: Response = await fetch(URL, {
        credentials: "include",
        method: fetchOptions?.method || "GET", // default GET
        ...fetchOptions,
      });
      if (!rawRes.ok) {
        const err: IGenericError = await rawRes.json();
        throw new Error(err.error);
      }
      const res: SessionResponse = await rawRes.json();
      setUnusedFiles([...res.unused]);
      setCheckedContracts([...res.contracts]);
      setAddedFiles([...res.files]);
      setErrorMessage("");
      return res;
    } catch (e) {
      const error = e as IResponseError;
      setErrorMessage(error.message);
    }
  };

  const handleFiles = async (files: DropzoneFile[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    await fetchAndUpdate(ADD_FILES_URL, {
      method: "POST",
      body: formData,
    });
  };

  const restartSession = async () => {
    await fetch(RESTART_SESSION_URL, {
      credentials: "include",
      method: "POST",
    });
    setUnusedFiles([]);
    setCheckedContracts([]);
    setAddedFiles([]);
    return;
  };

  /**
   * Function to submit a validated contract to verification with chainId and address.
   *
   * @param sendable -
   */
  const verifyCheckedContract = async (sendable: VerificationInput) => {
    console.log("Verifying checkedContract " + sendable.verificationId);
    return fetchAndUpdate(VERIFY_VALIDATED_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contracts: [sendable],
      }),
    });
  };

  return (
    <div className="flex flex-col flex-1">
      <Header />
      <Toast
        message={errorMessage}
        isShown={!!errorMessage}
        dismiss={() => setErrorMessage("")}
      />
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Verifier</h1>
        <p className="mt-2">
          Recompile contracts and check if the compiled bytecode matches with
          the on-chain bytecode
        </p>
      </div>
      <div className="flex flex-row flex-grow mt-6">
        <FileUpload
          handleFilesAdded={handleFiles}
          addedFiles={addedFiles}
          metadataMissing={
            unusedFiles.length > 0 && checkedContracts.length === 0
          }
          restartSession={restartSession}
          fetchAndUpdate={fetchAndUpdate}
        />
        {/* {checkedContracts.length > 0 && ( */}
        {/* <div className={`${checkedContracts.length > 0 ? "w-auto" : "w-0"}`}> */}
        <CheckedContractsView
          checkedContracts={checkedContracts}
          isHidden={checkedContracts.length < 1}
          verifyCheckedContract={verifyCheckedContract}
        />
        {/* </div> */}
        {/* )} */}
      </div>
    </div>
  );
};

export default Verifier;

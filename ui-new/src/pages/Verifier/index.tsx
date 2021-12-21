import { useState } from "react";
import Header from "../../components/Header";
import {
  ADD_FILES_URL,
  RESTART_SESSION_URL,
  VERIFY_VALIDATED_URL,
} from "../../constants";
import {
  DropzoneFile,
  SendableContract,
  SessionResponse,
  VerificationInput,
} from "../../types";
import CheckedContractsView from "./CheckedContractsView";
import FileUpload from "./FileUpload";

type FetchOptions = {
  credentials: "include";
  method: "GET" | "POST";
  body: HTMLFormElement | string;
  headers: Headers;
};

const Verifier: React.FC = () => {
  const [addedFiles, setAddedFiles] = useState<DropzoneFile[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [checkedContracts, setCheckedContracts] = useState<SendableContract[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  const fetchAndUpdate = async (URL: string, fetchOptions: RequestInit) => {
    setIsLoading(true);
    const res: SessionResponse = await fetch(URL, {
      credentials: "include",
      ...fetchOptions,
    }).then((res) => res.json());
    setUnusedFiles([...res.unused]);
    setCheckedContracts([...res.contracts]);
    setIsLoading(false);
  };

  const handleFiles = async (files: DropzoneFile[]) => {
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    await fetchAndUpdate(ADD_FILES_URL, {
      method: "POST",
      body: formData,
    });
    setAddedFiles(addedFiles.concat(files));
  };

  const restartSession = async () => {
    setIsLoading(true);
    await fetch(RESTART_SESSION_URL, {
      credentials: "include",
      method: "POST",
    });
    setUnusedFiles([]);
    setCheckedContracts([]);
    setAddedFiles([]);
    setIsLoading(false);
  };

  const verifyCheckedContract = async (sendable: VerificationInput) => {
    console.log("Verifying checkedContract " + sendable.verificationId);
    fetchAndUpdate(VERIFY_VALIDATED_URL, {
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
      <div className="text-center">
        <h1 className="text-3xl md:text-4xl font-bold">Verifier</h1>
        <p className="mt-2">
          Recompile contracts and check if the compiled bytecode matches with
          the on-chain bytecode
        </p>
      </div>
      <div className="flex flex-row flex-grow">
        <FileUpload
          handleFilesAdded={handleFiles}
          addedFiles={addedFiles}
          isLoading={isLoading}
          restartSession={restartSession}
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

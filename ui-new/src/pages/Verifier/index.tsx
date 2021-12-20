import { useState } from "react";
import Header from "../../components/Header";
import { ADD_FILES_URL, RESTART_SESSION_URL } from "../../constants";
import { DropzoneFile, SendableContract, SessionResponse } from "../../types";
import CheckedContractsView from "./CheckedContractsView";
import FileUpload from "./FileUpload";

const Verifier: React.FC = () => {
  const [addedFiles, setAddedFiles] = useState<DropzoneFile[]>([]);
  const [unusedFiles, setUnusedFiles] = useState<string[]>([]);
  const [checkedContracts, setCheckedContracts] = useState<SendableContract[]>(
    []
  );
  const [isLoading, setIsLoading] = useState(false);

  const handleFiles = async (files: DropzoneFile[]) => {
    setIsLoading(true);
    setAddedFiles(addedFiles.concat(files));
    if (files.length === 0) {
      console.log("Nothing to upload");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    let res: SessionResponse = await fetch(ADD_FILES_URL, {
      credentials: "include",
      method: "POST",
      body: formData,
    }).then((res) => res.json());
    setUnusedFiles([...res.unused]);
    setCheckedContracts([...res.contracts]);
    console.log(res);
    setIsLoading(false);
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
          unusedFiles={unusedFiles}
          checkedContracts={checkedContracts}
          isLoading={isLoading}
          restartSession={restartSession}
        />
        <CheckedContractsView />
      </div>
    </div>
  );
};

export default Verifier;

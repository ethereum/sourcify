import { useState } from "react";
import Header from "../../components/Header";
import { ADD_FILES_URL } from "../../constants";
import { DropzoneFile } from "../../types";
import FileUpload from "./FileUpload";

const Verifier: React.FC = () => {
  const [addedFiles, setAddedFiles] = useState<DropzoneFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleFiles = async (files: DropzoneFile[]) => {
    setIsLoading(true);
    setAddedFiles(files);
    if (files.length === 0) {
      console.log("Nothing to upload");
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    await new Promise((resolve) => setTimeout(resolve, 1500));
    let res = await fetch(ADD_FILES_URL, {
      method: "POST",
      body: formData,
    }).then((res) => res.json());
    console.log(res);
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
      <div className="flex flex-col flex-grow bg-ceruleanBlue-40 mt-2 md:mt-4 px-4 md:px-16">
        <div className="my-6 flex justify-center items-center">
          <p>Drag and drop the Solidity and metadata files below</p>
        </div>
        {isLoading ? (
          <div className="flex flex-grow items-center justify-center bg-ceruleanBlue-10 border-dashed border-ceruleanBlue-100 border-2 m-2 rounded-lg hover:bg-ceruleanBlue-70">
            {" "}
            Loading{" "}
          </div>
        ) : (
          <FileUpload handleFilesAdded={handleFiles} addedFiles={addedFiles} />
        )}
        <div className="mt-4">
          <p className="text-center">or proivide a Github repository</p>
          <div className="flex justify-center items-center mt-2">
            <input className="mb-4 w-full" type="text" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Verifier;

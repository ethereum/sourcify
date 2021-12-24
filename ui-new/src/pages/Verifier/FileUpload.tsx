import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { AiFillFileAdd } from "react-icons/ai";
import Input from "../../components/Input";
import LoadingOverlay from "../../components/LoadingOverlay";

type FileUploadProps = {
  handleFilesAdded: (files: []) => void;
  restartSession: () => void;
  addedFiles: string[];
  metadataMissing: boolean;
};

const FileUpload: React.FC<FileUploadProps> = ({
  handleFilesAdded,
  restartSession,
  addedFiles,
  metadataMissing,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles: any) => {
      setIsLoading(true);
      await handleFilesAdded(acceptedFiles);
      setIsLoading(false);
    },
  });
  // const dropzoneAcceptedFiles = acceptedFiles as DropzoneFile[]; // Typecast for file.path and file.size

  const displayFiles = addedFiles.map((file) => {
    return <li key={file}>{file}</li>;
  });
  console.log(addedFiles);
  return (
    <div className="flex flex-col basis-0 flex-grow bg-gray-200 shadow-lg rounded-lg mx-4 px-8 transition-all ease-in-out duration-300">
      <div className="mt-6 flex flex-col justify-center items-center">
        <h2 className="font-bold text-xl block">File Add Zone</h2>
        <p>Add the metadata and the Solidity source files for verification</p>
      </div>
      <div className="flex flex-grow flex-col mt-2">
        <div className="flex justify-end text-ceruleanBlue-100 hover:underline">
          <button
            onClick={async () => {
              setIsLoading(true);
              await restartSession();
              setIsLoading(false);
            }}
          >
            Clear Files
          </button>
        </div>
        <div
          {...getRootProps()}
          className="flex flex-col flex-grow cursor-pointer"
        >
          <div className="flex flex-col flex-grow border-dashed border-gray-500 border-2 rounded-lg hover:bg-gray-300 hover:border-ceruleanBlue-100 p-4 relative">
            <input {...getInputProps()} type="file" />
            {metadataMissing && (
              <div className="bg-red-400 text-gray-800 text-center py-2 rounded-lg">
                <p>Metadata files missing!</p>
              </div>
            )}
            {displayFiles.length ? (
              <div>
                <h2 className="font-bold text-lg">Added Files</h2>
                <ul className="flex flex-col">{displayFiles}</ul>
              </div>
            ) : (
              <div className="flex flex-col flex-grow justify-center items-center text-center">
                <AiFillFileAdd size="2em" className="text-ceruleanBlue-100" />
                <div className="mt-2">
                  Drag and drop files
                  <br /> or click to select
                </div>
              </div>
            )}
            {/* Loading Overlay */}
            {isLoading && <LoadingOverlay message="Checking contracts" />}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-center">or provide a Github repository</p>
        <div className="flex justify-center items-center mt-2">
          <Input placeholder="https://github.com/Uniswap/v3-core" />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

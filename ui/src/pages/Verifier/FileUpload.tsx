import React, { useState } from "react";
import { useDropzone } from "react-dropzone";
import { AiFillFileAdd } from "react-icons/ai";
import { HiOutlineExclamation } from "react-icons/hi";
import LoadingOverlay from "../../components/LoadingOverlay";
import { SessionResponse } from "../../types";
import GithubInput from "./GithubInput";

type FileUploadProps = {
  handleFilesAdded: (files: []) => void;
  restartSession: () => void;
  addedFiles: string[];
  metadataMissing: boolean;
  fetchAndUpdate: (
    URL: string,
    fetchOptions?: RequestInit
  ) => Promise<SessionResponse | undefined>;
};

const FileUpload: React.FC<FileUploadProps> = ({
  handleFilesAdded,
  restartSession,
  addedFiles,
  metadataMissing,
  fetchAndUpdate,
}) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (acceptedFiles: any) => {
      setIsLoading(true);
      await handleFilesAdded(acceptedFiles);
      setIsLoading(false);
    },
  });
  // const dropzoneAcceptedFiles = acceptedFiles as DropzoneFile[]; // Typecast for file.path and file.size

  const displayFiles = addedFiles.map((file) => {
    return <li key={file}>&bull; {file}</li>;
  });
  return (
    <div className="pt-1 bg-ceruleanBlue-500 flex flex-grow basis-0 rounded-xl mx-2 mb-4 md:mb-0">
      <div className="flex flex-col basis-0 flex-grow rounded-lg px-8 transition-all ease-in-out duration-300 bg-white overflow-hidden shadow-md">
        <div className="mt-8 flex flex-col justify-center items-center text-center">
          <h2 className="font-bold text-xl block">File Add Zone</h2>
          <p>
            Add the Solidity source files and metadata of all contracts you want
            to verify.
          </p>
        </div>
        <div className="flex flex-grow flex-col pb-8">
          <div className="mt-4">
            <p className="">
              Import from remote file or zip (e.g. Github repo .zip)
            </p>
            <div className="mt-1">
              <GithubInput
                fetchAndUpdate={fetchAndUpdate}
                setIsLoading={setIsLoading}
                isLoading={isLoading}
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={async () => {
                setIsLoading(true);
                await restartSession();
                setIsLoading(false);
              }}
              className="text-ceruleanBlue-500 font-medium hover:underline decoration-2 decoration-lightCoral-500 uppercase py-1 text-sm"
            >
              Clear Files
            </button>
          </div>
          <div
            {...getRootProps()}
            className="flex flex-col flex-grow cursor-pointer"
          >
            <div className="flex flex-col flex-grow border-dashed border-2 rounded-lg hover:bg-ceruleanBlue-100 border-ceruleanBlue-500 p-4 relative">
              <input {...getInputProps()} type="file" />
              {metadataMissing && (
                <div className="bg-red-100 text-red-700 text-center py-2 rounded-lg">
                  <HiOutlineExclamation
                    className="inline mr-2 text-red-700"
                    size="1.25em"
                  />
                  <p className="inline align-middle font-medium">
                    Metadata files missing!
                  </p>
                  <p className="text-sm">Please add contract metadata.json</p>
                </div>
              )}
              {displayFiles.length ? (
                <div>
                  <h2 className="font-bold text-lg">Added Files</h2>
                  <ul className="flex flex-col break-all">{displayFiles}</ul>
                </div>
              ) : (
                <div className="flex flex-col flex-grow justify-center items-center text-center">
                  <AiFillFileAdd size="2em" className="text-ceruleanBlue-500" />
                  <div className="mt-2">
                    Drag and drop here
                    <div style={{ lineHeight: "0.8em" }}> or </div>
                    <span className="text-ceruleanBlue-500">browse</span>
                  </div>
                </div>
              )}
              {/* Loading Overlay */}
              {isLoading && <LoadingOverlay message="Checking contracts" />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

import React from "react";
import { useDropzone } from "react-dropzone";
import { DropzoneFile } from "../../types";

type FileUploadProps = {
  handleFilesAdded: (files: []) => void;
  restartSession: () => void;
  addedFiles: DropzoneFile[];
  isLoading: boolean;
};

const FileUpload: React.FC<FileUploadProps> = ({
  handleFilesAdded,
  restartSession,
  addedFiles,
  isLoading,
}) => {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: any): void => {
      handleFilesAdded(acceptedFiles);
    },
  });
  // const dropzoneAcceptedFiles = acceptedFiles as DropzoneFile[]; // Typecast for file.path and file.size

  const displayFiles = addedFiles.map((file) => {
    return (
      <li key={file.name + file.size}>
        {file.name} - {file.size} bytes
      </li>
    );
  });
  console.log(addedFiles);
  return (
    <div className="flex flex-col basis-0 flex-grow bg-gray-200 shadow-lg rounded-lg mx-4 px-8 transition-all ease-in-out duration-300">
      <div className="mt-6 flex flex-col justify-center items-center">
        <h2 className="font-bold text-xl block">File Add Zone</h2>
        <p>Drag and drop the Solidity and metadata files below</p>
      </div>
      <div className="flex flex-grow flex-col mt-2">
        <div className="flex justify-end text-ceruleanBlue-100 hover:underline">
          <button onClick={restartSession}>Clear Files</button>
        </div>
        <div
          {...getRootProps()}
          className="flex flex-col flex-grow cursor-pointer"
        >
          <div className="flex-grow border-dashed border-gray-500 border-2 rounded-lg hover:bg-gray-300 hover:border-ceruleanBlue-100 p-4 relative">
            <input {...getInputProps()} type="file" />
            <h2 className="font-bold text-lg">Added Files</h2>
            <ul className="flex flex-col">{displayFiles}</ul>
            {isLoading && (
              <div className="flex w-full h-full items-center justify-center bg-ceruleanBlue-10 absolute top-0 left-0 opacity-80">
                <div className="opacity-100">Loading</div>
              </div>
            )}
          </div>
        </div>
      </div>
      <div className="mt-4">
        <p className="text-center">or provide a Github repository</p>
        <div className="flex justify-center items-center mt-2">
          <input
            className="mb-4 w-full rounded-md border-2 border-gray-400 p-1"
            type="text"
            placeholder="https://github.com/Uniswap/v3-core"
          />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

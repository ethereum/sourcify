import React from "react";
import { useDropzone } from "react-dropzone";
import { DropzoneFile, SendableContract } from "../../types";

type FileUploadProps = {
  handleFilesAdded: (files: []) => void;
  restartSession: () => void;
  addedFiles: DropzoneFile[];
  unusedFiles: string[];
  checkedContracts: SendableContract[];
  isLoading: boolean;
};

const FileUpload: React.FC<FileUploadProps> = ({
  handleFilesAdded,
  restartSession,
  addedFiles,
  unusedFiles,
  checkedContracts,
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
      <li key={file.name}>
        {file.name} - {file.size} bytes
      </li>
    );
  });
  console.log(addedFiles);
  return (
    <div className="flex flex-col basis-0 flex-grow bg-ceruleanBlue-40 mx-4 px-8">
      <div className="my-6 flex justify-center items-center">
        <p>Drag and drop the Solidity and metadata files below</p>
      </div>
      <div className="flex justify-end">
        <button onClick={restartSession}>Clear Files</button>
      </div>
      <div
        {...getRootProps()}
        className="flex flex-col flex-grow bg-ceruleanBlue-10 cursor-pointer"
      >
        <div className="flex-grow bg-ceruleanBlue-10 border-dashed border-ceruleanBlue-100 border-2 m-2 rounded-lg hover:bg-ceruleanBlue-70">
          <input {...getInputProps()} type="file" />
          <div className="font-bold text-lg">Added Files</div>
          <div className="flex flex-col">{displayFiles}</div>
          {isLoading && (
            <div className="flex flex-grow items-center justify-center bg-ceruleanBlue-10 border-dashed border-ceruleanBlue-100 border-2 m-2 rounded-lg hover:bg-ceruleanBlue-70"></div>
          )}
          {/* {unusedFiles.length > 0 ? (
            <div>
              <div className="font-bold underline">Unused Files</div>
              <ul>
                {unusedFiles.map((file) => (
                  <li>{file}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p>Drag 'n' drop some files here, or click to select files</p>
          )}
          {checkedContracts.length > 0 && (
            <div className="font-bold underline text-lg">Contract Files</div>
          )}
          {
            <div>
              {checkedContracts.map((checkedContract) => (
                <div className="ml-4">
                  <p className="underline">{checkedContract.name}</p>
                  {checkedContract.files.found.map((file) => (
                    <p>{file}</p>
                  ))}
                </div>
              ))}
            </div>
          } */}
        </div>
      </div>
      <div className="mt-4">
        <p className="text-center">or proivide a Github repository</p>
        <div className="flex justify-center items-center mt-2">
          <input className="mb-4 w-full" type="text" />
        </div>
      </div>
    </div>
  );
};

export default FileUpload;

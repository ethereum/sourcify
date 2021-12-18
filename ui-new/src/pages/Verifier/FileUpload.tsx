import React from "react";
import { useDropzone } from "react-dropzone";

type FileUploadProps = {
  handleFilesAdded: (files: []) => void;
  addedFiles: any[];
};

const FileUpload: React.FC<FileUploadProps> = ({
  handleFilesAdded,
  addedFiles,
}) => {
  const { acceptedFiles, getRootProps, getInputProps } = useDropzone({
    onDrop: (acceptedFiles: any): void => {
      handleFilesAdded(acceptedFiles);
    },
  });
  // const dropzoneAcceptedFiles = acceptedFiles as DropzoneFile[]; // Typecast for file.path and file.size

  const displayFiles = addedFiles.map((file) => {
    return (
      <li key={file.path}>
        {file.path} - {file.size} bytes
      </li>
    );
  });
  console.log(addedFiles);
  return (
    <div
      {...getRootProps()}
      className="flex flex-col flex-grow bg-ceruleanBlue-10 cursor-pointer"
    >
      <div className="flex-grow bg-ceruleanBlue-10 border-dashed border-ceruleanBlue-100 border-2 m-2 rounded-lg hover:bg-ceruleanBlue-70">
        <input {...getInputProps()} type="file" />
        <p>Drag 'n' drop some files here, or click to select files</p>
      </div>
      <div className="flex flex-col">{displayFiles}</div>
    </div>
  );
};

export default FileUpload;

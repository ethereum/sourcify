import React from 'react';
import {useDropzone} from 'react-dropzone';
import {CirclePlusIcon, FileIcon} from "../../icons";

type FileUploadProps = {
    handleFiles: (files: []) => void,
    files: any[]
}

type FileForUploadProps = {
    name: string,
    className: string
}

const FileForUpload: React.FC<FileForUploadProps> = ({name, className}) => (
    <li className={className}>
        <FileIcon/>
        <span>{name}</span>
    </li>
);

const FileUpload: React.FC<FileUploadProps> = ({handleFiles, files}) => {
    const {getRootProps, getInputProps} = useDropzone({
        onDrop: (acceptedFiles: any): void => {
            handleFiles(acceptedFiles);
        },
        noDragEventsBubbling: true
    });

    return (
        <>
            <div {...getRootProps()} className="file-upload">
                {
                    files.length > 0 ?
                        <ul className="file-upload__list">
                            {files.map((file: any, index: number) => <FileForUpload className="file-upload__item"
                                                                                    key={index}
                                                                                    name={file.name}/>)}
                        </ul>
                        :
                        <div className="file-upload__details">
                            <CirclePlusIcon/>
                            <p>Drag and drop files</p>
                            <p>or click to upload</p>
                        </div>
                }
            </div>
            <div {...getRootProps()}>
                <input {...getInputProps()} />
            </div>
        </>
    );
};

export default FileUpload;
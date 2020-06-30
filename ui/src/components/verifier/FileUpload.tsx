import React, {useState} from 'react';

import {useDropzone} from 'react-dropzone';
import {CirclePlusIcon, FileIcon} from "../icons";

type UploadFileProps = {
    name: string,
    className: string
}

const UploadedFile = ({name, className}: UploadFileProps) => (
    <li className={className}>
        <FileIcon />
        <span>{name}</span>
    </li>
);

const FileUpload: React.FC = () => {
    const [filesToUpload, setFilesToUpload] = useState<any>([]);
    const { getRootProps, getInputProps } = useDropzone({
        onDrop: (acceptedFiles: any): void => {
            console.log("Dropped");
            console.log(acceptedFiles);
            setFilesToUpload([...filesToUpload, ...acceptedFiles])
            console.log(filesToUpload);
        },
        noDragEventsBubbling: true
    });

    const clearAllFiles = (event: React.MouseEvent<HTMLButtonElement, MouseEvent>): void => {
        event.preventDefault();
        setFilesToUpload([]);
    }

    return (
        <>
            {
                filesToUpload.length > 0 && <div className="form__file-upload-header">
                    <span>FILES ({filesToUpload.length})</span>
                    <button onClick={clearAllFiles}>CLEAR ALL</button>
                </div>
            }
            <div {...getRootProps()} className="file-upload">
                {
                    filesToUpload.length > 0 ?
                        <ul className="file-upload__list">
                            {filesToUpload.map((file: any, index: number) => <UploadedFile className="file-upload__item"
                                                                                           key={index}
                                                                                           name={file.name}/>)}
                        </ul>
                        :
                        <div className="file-upload__details">
                            <CirclePlusIcon />
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